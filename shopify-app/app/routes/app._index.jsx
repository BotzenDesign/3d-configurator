import { useState, useCallback } from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "@remix-run/react";
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
import { PlusIcon, EditIcon, DeleteIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

// ── Supabase helper (server-side only) ────────────────────────────────────────
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

// ── Loader — read materials + settings from Supabase ─────────────────────────
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
    console.error("Supabase load error (Tables missing?):", error.message);
  }

  return json({ materials, settings });
};

// ── Action — handle form submissions ─────────────────────────────────────────
export const action = async ({ request }) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    switch (intent) {
      case "saveMaterial": {
        const id = formData.get("id");
        const isNew = formData.get("isNew") === "true";
        const colors = formData
          .get("colors")
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
        const payload = {
          id,
          label: formData.get("label"),
          price_label: formData.get("price_label"),
          type: formData.get("type"),
          spool_cost: Number(formData.get("spool_cost")),
          spool_quantity: Number(formData.get("spool_quantity")),
          colors,
          is_active: formData.get("is_active") === "true",
        };

        if (isNew) {
          await supabaseFetch("/materials", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        } else {
          const { id: _id, ...updatePayload } = payload;
          await supabaseFetch(`/materials?id=eq.${id}`, {
            method: "PATCH",
            body: JSON.stringify(updatePayload),
          });
        }
        return json({ success: true });
      }

      case "deleteMaterial": {
        const id = formData.get("id");
        await supabaseFetch(`/materials?id=eq.${id}`, { method: "DELETE" });
        return json({ success: true });
      }

      case "toggleMaterial": {
        const id = formData.get("id");
        const current = formData.get("is_active") === "true";
        await supabaseFetch(`/materials?id=eq.${id}`, {
          method: "PATCH",
          body: JSON.stringify({ is_active: !current }),
        });
        return json({ success: true });
      }

      case "saveSetting": {
        const key = formData.get("key");
        const value = formData.get("value");
        await supabaseFetch(`/app_settings?key=eq.${key}`, {
          method: "PATCH",
          body: JSON.stringify({ value }),
        });
        return json({ success: true });
      }

      default:
        return json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { materials, settings } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";
  // Tabs
  const [selectedTab, setSelectedTab] = useState(0);

  // Material modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [currentMaterial, setCurrentMaterial] = useState(null);

  // Setting inline edit state
  const [editedSettings, setEditedSettings] = useState({});

  // ── Handlers ──────────────────────────────────────────────────────────────
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

  const handleSaveMaterial = useCallback(() => {
    if (!currentMaterial) return;
    const fd = new FormData();
    fd.append("intent", "saveMaterial");
    Object.entries(currentMaterial).forEach(([k, v]) => {
      if (k !== "isNew") fd.append(k, String(v));
    });
    fd.append("isNew", String(!!currentMaterial.isNew));
    submit(fd, { method: "post" });
    setModalOpen(false);
  }, [currentMaterial, submit]);

  const handleDeleteMaterial = useCallback(
    (id) => {
      const fd = new FormData();
      fd.append("intent", "deleteMaterial");
      fd.append("id", id);
      submit(fd, { method: "post" });
      setDeleteConfirmId(null);
    },
    [submit]
  );

  const handleToggleActive = useCallback(
    (id, isActive) => {
      const fd = new FormData();
      fd.append("intent", "toggleMaterial");
      fd.append("id", id);
      fd.append("is_active", String(isActive));
      submit(fd, { method: "post" });
    },
    [submit]
  );

  const handleSaveSetting = useCallback(
    (key) => {
      const value = editedSettings[key];
      if (value === undefined) return;
      const fd = new FormData();
      fd.append("intent", "saveSetting");
      fd.append("key", key);
      fd.append("value", value);
      submit(fd, { method: "post" });
    },
    [editedSettings, submit]
  );

  // ── Materials table rows ──────────────────────────────────────────────────
  const materialRows = materials.map((mat) => {
    const unitRate =
      mat.spool_quantity > 0
        ? `$${(Number(mat.spool_cost) / Number(mat.spool_quantity)).toFixed(4)}/g`
        : "—";
    return [
      <Badge tone={mat.type === "SLA" ? "attention" : "info"} key="type">
        {mat.type}
      </Badge>,
      <Text key="label" fontWeight="semibold">
        {mat.label}
        <Text as="span" tone="subdued" variant="bodySm">
          {" "}
          ({mat.id})
        </Text>
      </Text>,
      `$${Number(mat.spool_cost).toFixed(2)}`,
      `${Number(mat.spool_quantity).toFixed(0)} g`,
      unitRate,
      Array.isArray(mat.colors) ? mat.colors.join(", ") : mat.colors,
      <Badge key="status" tone={mat.is_active ? "success" : "critical"}>
        {mat.is_active ? "Active" : "Inactive"}
      </Badge>,
      <InlineStack gap="100" key="actions">
        <Button
          variant="plain"
          icon={EditIcon}
          onClick={() => openEditModal(mat)}
          accessibilityLabel={`Edit ${mat.label}`}
        />
        <Button
          variant="plain"
          tone="critical"
          icon={DeleteIcon}
          onClick={() => setDeleteConfirmId(mat.id)}
          accessibilityLabel={`Delete ${mat.label}`}
        />
        <Button
          variant="plain"
          tone={mat.is_active ? "critical" : "success"}
          onClick={() => handleToggleActive(mat.id, mat.is_active)}
        >
          {mat.is_active ? "Disable" : "Enable"}
        </Button>
      </InlineStack>,
    ];
  });

  // ── Setting descriptions ─────────────────────────────────────────────────
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
      {isLoading && (
        <Banner tone="info">
          <InlineStack gap="200" blockAlign="center">
            <Spinner size="small" />
            <Text>Saving changes…</Text>
          </InlineStack>
        </Banner>
      )}

      {actionData?.error && (
        <Banner tone="critical" title="An error occurred">
          <Text>{actionData.error}</Text>
        </Banner>
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
                    M = Spool/Bottle Cost, Q = Material Quantity (g),
                    B = material consumed (g), Y = material multiplier, W =
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
                      "text","text","numeric","numeric","numeric","text","text","text",
                    ]}
                    headings={[
                      "Type","Name","M — Spool Cost","Qty (g)","Unit Rate","Colors","Status","Actions",
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
                            label=""
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

      {/* ── Add / Edit Material Modal ──────────────────────────────────────── */}
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
                  <strong>
                    Y × M/Q × B
                  </strong>
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

              <FormLayout.Group>
                <TextField
                  label="Display Name"
                  value={currentMaterial.label}
                  onChange={(v) =>
                    setCurrentMaterial({ ...currentMaterial, label: v })
                  }
                  autoComplete="off"
                />
                <TextField
                  label="Description / Sub-label"
                  value={currentMaterial.price_label}
                  onChange={(v) =>
                    setCurrentMaterial({ ...currentMaterial, price_label: v })
                  }
                  placeholder="e.g. $35/1000g spool"
                  autoComplete="off"
                />
              </FormLayout.Group>

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
                    setCurrentMaterial({
                      ...currentMaterial,
                      spool_cost: v,
                    })
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
                    setCurrentMaterial({
                      ...currentMaterial,
                      spool_quantity: v,
                    })
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

      {/* ── Delete Confirmation Modal ──────────────────────────────────────── */}
      <Modal
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Material"
        primaryAction={{
          content: "Delete",
          destructive: true,
          onAction: () => handleDeleteMaterial(deleteConfirmId),
        }}
        secondaryActions={[
          { content: "Cancel", onAction: () => setDeleteConfirmId(null) },
        ]}
      >
        <Modal.Section>
          <Text>
            Are you sure you want to delete this material? This action cannot be
            undone. Existing quotes using this material will not be affected.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
