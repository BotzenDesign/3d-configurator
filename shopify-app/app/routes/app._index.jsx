import { useState, useCallback, useEffect } from "react";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Button,
  Badge,
  Modal,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  Banner,
  Text,
  InlineStack,
  BlockStack,
  Divider,
  Spinner,
  EmptyState,
  Tabs,
} from "@shopify/polaris";
import { PlusIcon, EditIcon, DeleteIcon, DuplicateIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

// ── Shared secret (must match api.admin.jsx) ───────────────────────────────────
const ADMIN_SECRET = "polar3d-admin-secret";

// ── Helper: use XHR instead of fetch so App Bridge cannot intercept/hang it ────
// App Bridge patches window.fetch to inject Shopify session tokens.
// When the postMessage tunnel breaks, patched fetch hangs forever.
// XMLHttpRequest is never patched by App Bridge.
function adminAPI(intent, data = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin", true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("x-admin-secret", ADMIN_SECRET);
    xhr.timeout = 20000; // 20-second hard timeout

    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && !body.error) {
          resolve(body);
        } else {
          reject(new Error(body.error || `Server error ${xhr.status}`));
        }
      } catch {
        reject(new Error(`Non-JSON response (${xhr.status}): ${xhr.responseText.slice(0, 200)}`));
      }
    };
    xhr.onerror   = () => reject(new Error("Network error — check Railway is running"));
    xhr.ontimeout = () => reject(new Error("Request timed out after 20s"));
    xhr.send(JSON.stringify({ intent, ...data }));
  });
}

// ── Supabase helper (server-side only, for loader) ─────────────────────────────
async function supabaseFetch(path, options = {}) {
  const url = `${process.env.SUPABASE_URL}/rest/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=representation",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error ${res.status}: ${err}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Loader — read materials + settings from Supabase ──────────────────────────
export const loader = async ({ request }) => {
  await authenticate.admin(request);

  let materials = [];
  let settings = [];

  try {
    const results = await Promise.all([
      supabaseFetch("/materials?order=type.asc,label.asc&select=*"),
      supabaseFetch("/app_settings?order=key.asc&select=*"),
    ]);
    materials = results[0] ?? [];
    settings = results[1] ?? [];
  } catch (error) {
    console.error("Supabase load error:", error.message);
  }

  return json({ materials, settings });
};

// ── Component ──────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { materials: initialMaterials, settings: initialSettings } = useLoaderData();

  // Local state — keeps in sync without page reload
  const [materials, setMaterials] = useState(initialMaterials);
  const [settings, setSettings] = useState(initialSettings);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Tabs
  const [selectedTab, setSelectedTab] = useState(0);

  // Material modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [currentMaterial, setCurrentMaterial] = useState(null);

  // Setting inline edit state
  const [editedSettings, setEditedSettings] = useState({});

  // Clear success message after 3s
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  // ── Refresh data from API ─────────────────────────────────────────────────
  const refreshData = useCallback(async () => {
    try {
      const [matRes, setRes] = await Promise.all([
        adminAPI("getMaterials"),
        adminAPI("getSettings"),
      ]);
      setMaterials(matRes.data ?? []);
      setSettings(setRes.data ?? []);
    } catch (err) {
      console.error("Refresh error:", err.message);
    }
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const openAddModal = useCallback(() => {
    setCurrentMaterial({
      id: "",
      label: "",
      price_label: "",
      type: "FDM",
      spool_cost: "35",
      spool_quantity: "335",
      colors: "Red, Blue, White, Black",
      is_active: true,
      isNew: true,
    });
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((mat) => {
    setCurrentMaterial({
      ...mat,
      colors: Array.isArray(mat.colors) ? mat.colors.join(", ") : mat.colors,
      isNew: false,
    });
    setModalOpen(true);
  }, []);

  const openDuplicateModal = useCallback((mat) => {
    setCurrentMaterial({
      ...mat,
      id: mat.id + "_copy",
      label: mat.label + " (Copy)",
      colors: Array.isArray(mat.colors) ? mat.colors.join(", ") : mat.colors,
      isNew: true,
    });
    setModalOpen(true);
  }, []);

  const handleSaveMaterial = useCallback(async () => {
    if (!currentMaterial) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await adminAPI("saveMaterial", {
        id: currentMaterial.id,
        isNew: !!currentMaterial.isNew,
        label: currentMaterial.label,
        price_label: currentMaterial.price_label,
        type: currentMaterial.type,
        spool_cost: Number(currentMaterial.spool_cost),
        spool_quantity: Number(currentMaterial.spool_quantity),
        colors: currentMaterial.colors,
        is_active: currentMaterial.is_active,
      });
      setModalOpen(false);
      setSuccessMsg("Material saved successfully!");
      await refreshData();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentMaterial, refreshData]);

  const handleDeleteMaterial = useCallback(async (id) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await adminAPI("deleteMaterial", { id });
      setDeleteConfirmId(null);
      setSuccessMsg("Material deleted.");
      await refreshData();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [refreshData]);

  const handleToggleActive = useCallback(async (id, isActive) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await adminAPI("toggleMaterial", { id, is_active: isActive });
      setSuccessMsg(`Material ${isActive ? "disabled" : "enabled"}.`);
      await refreshData();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [refreshData]);

  const handleSaveSetting = useCallback(async (key) => {
    const value = editedSettings[key];
    if (value === undefined) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await adminAPI("saveSetting", { key, value });
      setSuccessMsg(`Setting "${key}" saved.`);
      setEditedSettings((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await refreshData();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [editedSettings, refreshData]);

  const materialRows = materials.map((mat) => {
    const unitRate =
      mat.spool_quantity > 0
        ? `$${(Number(mat.spool_cost) / Number(mat.spool_quantity)).toFixed(4)}/g`
        : "—";
    return [
      <InlineStack gap="200" wrap={false} blockAlign="center" key="type-actions">
        <InlineStack gap="0" wrap={false}>
          <Button
            variant="plain"
            icon={EditIcon}
            onClick={() => openEditModal(mat)}
            accessibilityLabel={`Edit ${mat.label}`}
          />
          <Button
            variant="plain"
            icon={DuplicateIcon}
            onClick={() => openDuplicateModal(mat)}
            accessibilityLabel={`Duplicate ${mat.label}`}
          />
        </InlineStack>
        <Badge tone={mat.type === "SLA" ? "attention" : "info"}>
          {mat.type}
        </Badge>
      </InlineStack>,
      <Text key="label" fontWeight="semibold">
        {mat.label}
        <Text as="span" tone="subdued" variant="bodySm">
          {" "}
          ({mat.id})
        </Text>
      </Text>,
      <div style={{ whiteSpace: "normal", maxWidth: "180px", wordBreak: "break-word" }} key="colors">
        {Array.isArray(mat.colors) ? mat.colors.join(", ") : mat.colors}
      </div>,
      `$${Number(mat.spool_cost).toFixed(2)}`,
      `${Number(mat.spool_quantity).toFixed(0)}g`,
      unitRate,
      <Badge key="status" tone={mat.is_active ? "success" : "critical"}>
        {mat.is_active ? "Active" : "Inactive"}
      </Badge>,
      <InlineStack gap="100" key="actions-right" blockAlign="center">
        <Button
          variant="plain"
          tone={mat.is_active ? "critical" : "success"}
          onClick={() => handleToggleActive(mat.id, mat.is_active)}
        >
          {mat.is_active ? "Disable" : "Enable"}
        </Button>
        <Button
          variant="plain"
          tone="critical"
          icon={DeleteIcon}
          onClick={() => setDeleteConfirmId(mat.id)}
          accessibilityLabel={`Delete ${mat.label}`}
        />
      </InlineStack>,
    ];
  });

  // ── Setting descriptions ─────────────────────────────────────────────────────
  const settingDescriptions = {
    material_multiplier_Y:
      "Y — Material cost multiplier (e.g. 2.0 = 2× the raw material cost). Used in Botzen Formula: Price = (Y×M/Q×B) + W×T",
    run_time_multiplier_W:
      "W — Machine run-time charge in $/hour (e.g. 1.25 = $1.25 per print-hour).",
    max_file_size_mb: "Maximum upload file size for STL/OBJ/3MF in megabytes.",
    supports_enabled: "Enable support structure volume calculations (true/false).",
    support_density: "Support structure density as a fraction of model volume (0.0–1.0).",
    raft_enabled: "Enable raft base calculation for FDM prints (true/false).",
    raft_layers: "Number of raft layers to calculate.",
    layer_height_fdm: "Default FDM layer height in mm (affects print time calculation).",
  };

  const tabs = [
    { id: "materials", content: "Materials & Pricing", panelID: "materials-panel" },
    { id: "settings", content: "Global Settings", panelID: "settings-panel" },
  ];

  return (
    <Page
      title="3D Configurator Admin"
      subtitle="Manage pricing, materials, and global settings for your 3D print shop"
      primaryAction={
        selectedTab === 0
          ? {
              content: "Add Material",
              icon: PlusIcon,
              onAction: openAddModal,
            }
          : undefined
      }
    >
      {/* ── Status Banners ─────────────────────────────────────────────────── */}
      {isLoading && (
        <div style={{ marginBottom: "16px" }}>
          <Banner tone="info">
            <InlineStack gap="200" blockAlign="center">
              <Spinner size="small" />
              <Text>Saving changes…</Text>
            </InlineStack>
          </Banner>
        </div>
      )}

      {errorMsg && (
        <div style={{ marginBottom: "16px" }}>
          <Banner
            tone="critical"
            title="An error occurred"
            onDismiss={() => setErrorMsg(null)}
          >
            <Text>{errorMsg}</Text>
          </Banner>
        </div>
      )}

      {successMsg && (
        <div style={{ marginBottom: "16px" }}>
          <Banner
            tone="success"
            title="Success"
            onDismiss={() => setSuccessMsg(null)}
          >
            <Text>{successMsg}</Text>
          </Banner>
        </div>
      )}

      <Layout>
        <Layout.Section>
          <Card>
            <Tabs
              tabs={tabs}
              selected={selectedTab}
              onSelect={setSelectedTab}
            />

            {/* ── Materials Tab ─────────────────────────────────────────── */}
            {selectedTab === 0 && (
              <BlockStack gap="400">
                <Banner tone="info">
                  <Text>
                    Botzen Formula:{" "}
                    <strong>Price = (Y × M/Q × B) + W × T</strong>
                    <br />
                    M = Spool/Bottle Cost, Q = Material Quantity (g), B =
                    material consumed (g), Y = material multiplier, W =
                    run-time $/hr, T = print time (hrs)
                  </Text>
                </Banner>

                {materials.length === 0 ? (
                  <EmptyState
                    heading="No materials yet"
                    action={{ content: "Add Material", onAction: openAddModal }}
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <Text>
                      Add FDM and SLA materials with spool costs to enable
                      instant quotes.
                    </Text>
                  </EmptyState>
                ) : (
                  <DataTable
                    columnContentTypes={[
                      "text","text","text","numeric","numeric","numeric","text","text",
                    ]}
                    headings={[
                      "Type","Name","Colors","Cost","Qty","Rate","Status","Actions",
                    ]}
                    rows={materialRows}
                    hoverable
                  />
                )}
              </BlockStack>
            )}

            {/* ── Settings Tab ──────────────────────────────────────────── */}
            {selectedTab === 1 && (
              <BlockStack gap="500">
                {settings.length === 0 ? (
                  <Banner tone="warning">
                    No settings found. Run{" "}
                    <code>setup_admin.sql</code> in your Supabase SQL Editor to
                    seed the app settings.
                  </Banner>
                ) : (
                  settings.map((setting) => (
                    <BlockStack gap="200" key={setting.key}>
                      <Text variant="headingSm" fontWeight="semibold">
                        {setting.key.replace(/_/g, " ")}
                      </Text>
                      <Text tone="subdued" variant="bodySm">
                        {settingDescriptions[setting.key] ??
                          setting.description ??
                          ""}
                      </Text>
                      <InlineStack gap="200" blockAlign="end">
                        <div style={{ flex: 1 }}>
                          <TextField
                            label={setting.key}
                            labelHidden
                            value={
                              editedSettings[setting.key] !== undefined
                                ? editedSettings[setting.key]
                                : String(setting.value)
                            }
                            onChange={(val) =>
                              setEditedSettings((prev) => ({
                                ...prev,
                                [setting.key]: val,
                              }))
                            }
                            autoComplete="off"
                            monospaced
                          />
                        </div>
                        <Button
                          variant="primary"
                          onClick={() => handleSaveSetting(setting.key)}
                          disabled={editedSettings[setting.key] === undefined}
                          loading={isLoading}
                        >
                          Save
                        </Button>
                      </InlineStack>
                      <Divider />
                    </BlockStack>
                  ))
                )}
              </BlockStack>
            )}
          </Card>
        </Layout.Section>
      </Layout>

      {/* ── Add / Edit Material Modal ──────────────────────────────────── */}
      {currentMaterial && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={
            currentMaterial.isNew
              ? "Add New Material"
              : `Edit — ${currentMaterial.label}`
          }
          primaryAction={{
            content: "Save Material",
            onAction: handleSaveMaterial,
            loading: isLoading,
          }}
          secondaryActions={[
            { content: "Cancel", onAction: () => setModalOpen(false) },
          ]}
          size="large"
        >
          <Modal.Section>
            <FormLayout>
              <Banner tone="info">
                <Text>
                  Formula:{" "}
                  <strong>Y × M/Q × B</strong>
                  &nbsp;— Set M (cost) and Q (quantity in grams) below.
                </Text>
              </Banner>

              <FormLayout.Group>
                <TextField
                  label="Material ID (unique, no spaces)"
                  value={currentMaterial.id}
                  onChange={(v) =>
                    setCurrentMaterial({ ...currentMaterial, id: v })
                  }
                  disabled={!currentMaterial.isNew}
                  helpText="e.g. PLA_TOUGH — cannot be changed after creation"
                  autoComplete="off"
                />
                <Select
                  label="Print Type"
                  options={[
                    { label: "FDM (Filament)", value: "FDM" },
                    { label: "SLA (Resin)", value: "SLA" },
                  ]}
                  value={currentMaterial.type}
                  onChange={(v) =>
                    setCurrentMaterial({ ...currentMaterial, type: v })
                  }
                />
              </FormLayout.Group>

              <TextField
                label="Display Name"
                value={currentMaterial.label}
                onChange={(v) =>
                  setCurrentMaterial({ ...currentMaterial, label: v })
                }
                autoComplete="off"
              />

              <Divider />
              <Text variant="headingSm" fontWeight="semibold">
                Botzen Formula Variables
              </Text>

              <FormLayout.Group>
                <TextField
                  label="M — Spool / Bottle Cost ($)"
                  type="number"
                  value={String(currentMaterial.spool_cost)}
                  onChange={(v) =>
                    setCurrentMaterial({ ...currentMaterial, spool_cost: v })
                  }
                  prefix="$"
                  helpText="Total purchase price of one spool or resin bottle"
                  autoComplete="off"
                />
                <TextField
                  label="Q — Material Quantity (grams)"
                  type="number"
                  value={String(currentMaterial.spool_quantity)}
                  onChange={(v) =>
                    setCurrentMaterial({ ...currentMaterial, spool_quantity: v })
                  }
                  suffix="g"
                  helpText="Total quantity of material in grams (e.g., 1000g for a 1kg package)"
                  autoComplete="off"
                />
              </FormLayout.Group>

              {Number(currentMaterial.spool_quantity) > 0 && (
                <Banner tone="success">
                  <Text>
                    Unit rate (M/Q):{" "}
                    <strong>
                      $
                      {(
                        Number(currentMaterial.spool_cost) /
                        Number(currentMaterial.spool_quantity)
                      ).toFixed(5)}
                      /g
                    </strong>
                  </Text>
                </Banner>
              )}

              <TextField
                label="Available Colors (comma separated)"
                value={currentMaterial.colors}
                onChange={(v) =>
                  setCurrentMaterial({ ...currentMaterial, colors: v })
                }
                placeholder="Red, Blue, White, Black, Green"
                helpText="These appear as color options in the storefront configurator"
                autoComplete="off"
              />

              <Checkbox
                label="Active (visible in configurator)"
                checked={currentMaterial.is_active}
                onChange={(v) =>
                  setCurrentMaterial({ ...currentMaterial, is_active: v })
                }
              />
            </FormLayout>
          </Modal.Section>
        </Modal>
      )}

      {/* ── Delete Confirmation Modal ──────────────────────────────────── */}
      <Modal
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Material"
        primaryAction={{
          content: "Delete",
          destructive: true,
          loading: isLoading,
          onAction: () => handleDeleteMaterial(deleteConfirmId),
        }}
        secondaryActions={[
          { content: "Cancel", onAction: () => setDeleteConfirmId(null) },
        ]}
      >
        <Modal.Section>
          <Text>
            Are you sure you want to delete this material? This action cannot be
            undone.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
