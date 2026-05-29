import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { LogOut, Plus, Save, Trash2, Edit } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

export default function AdminDashboard() {
  const [session, setSession] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Edit Material State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentMaterial, setCurrentMaterial] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/admin');
      } else {
        setSession(session);
        fetchData();
      }
    });
  }, [navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [matRes, setRes] = await Promise.all([
        supabase.from('materials').select('*'),
        supabase.from('app_settings').select('*')
      ]);

      if (matRes.error) throw matRes.error;
      if (setRes.error) throw setRes.error;

      setMaterials(matRes.data || []);
      setSettings(setRes.data || []);
    } catch (err: any) {
      toast.error('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin');
  };

  const handleSaveSetting = async (key: string, value: string) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ value })
        .eq('key', key);
      
      if (error) throw error;
      toast.success(`Updated ${key}`);
      fetchData();
    } catch (err: any) {
      toast.error('Failed to update setting: ' + err.message);
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!confirm('Are you sure you want to delete this material?')) return;
    try {
      const { error } = await supabase.from('materials').delete().eq('id', id);
      if (error) throw error;
      toast.success('Material deleted');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to delete material: ' + err.message);
    }
  };

  const handleToggleMaterialActive = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase.from('materials').update({ is_active: !current }).eq('id', id);
      if (error) throw error;
      toast.success('Material status updated');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to update material: ' + err.message);
    }
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedCost = Number(currentMaterial.spool_cost) || 0;
      const parsedQty = Number(currentMaterial.spool_quantity) || 0;
      
      let computedCostPerGram = 0;
      if (parsedQty > 0) {
        computedCostPerGram = parsedCost / parsedQty;
      }
      
      // Safety check to ensure it's never NaN or null
      if (isNaN(computedCostPerGram) || !isFinite(computedCostPerGram)) {
        computedCostPerGram = 0;
      }

      if (currentMaterial.isNew) {
        const { isNew, ...dataToInsert } = currentMaterial;
        dataToInsert.cost_per_gram = computedCostPerGram;
        dataToInsert.spool_cost = parsedCost;
        dataToInsert.spool_quantity = parsedQty;
        
        console.log("Inserting material:", dataToInsert);
        const { data, error } = await supabase.from('materials').insert([dataToInsert]).select();
        console.log("Insert result:", { data, error });
        if (error) throw error;
        toast.success('Material created');
      } else {
        const dataToUpdate = {
            label:          currentMaterial.label,
            price_label:    currentMaterial.price_label,
            type:           currentMaterial.type,
            spool_cost:     parsedCost,
            spool_quantity: parsedQty,
            cost_per_gram:  computedCostPerGram,
            colors:         currentMaterial.colors,
        };
        console.log("Updating material:", dataToUpdate);
        const { data, error } = await supabase
          .from('materials')
          .update(dataToUpdate)
          .eq('id', currentMaterial.id)
          .select();
        console.log("Update result:", { data, error });
        if (error) throw error;
        toast.success('Material updated');
      }
      setIsEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error("Save Material Error:", err);
      toast.error('Failed to save material: ' + err.message);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-card p-4 rounded-xl shadow-sm border border-border">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage 3D Configurator Pricing & Materials</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>

        <Tabs defaultValue="materials" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="materials">Materials & Pricing</TabsTrigger>
            <TabsTrigger value="settings">Global Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="materials" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => {
                setCurrentMaterial({
                  id: `NEW_${Date.now()}`,
                  label: '',
                  price_label: '',
                  type: 'FDM',
                  cost_per_gram: 0.035,
                  spool_cost: 35,
                  spool_quantity: 335,
                  colors: [],
                  is_active: true,
                  isNew: true
                });
                setIsEditModalOpen(true);
              }} className="flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Material
              </Button>
            </div>
            
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-x-auto">
              <Table className="w-full min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead title="M: Purchase price of spool/bottle">M — Spool Cost ($)</TableHead>
                    <TableHead title="Spool/Bottle quantity in grams">Qty (g)</TableHead>
                    <TableHead title="M/Q: unit rate">Unit Rate</TableHead>
                    <TableHead>Colors</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.map((mat) => (
                    <TableRow key={mat.id}>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${mat.type === 'SLA' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'}`}>
                          {mat.type}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>{mat.label}</div>
                        <div className="text-xs text-muted-foreground">{mat.id}</div>
                      </TableCell>
                      <TableCell>${Number(mat.spool_cost ?? 0).toFixed(2)}</TableCell>
                      <TableCell>
                        {Number(mat.spool_quantity ?? 0).toFixed(0)}
                        <span className="text-xs text-muted-foreground ml-1">g</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {mat.spool_quantity > 0
                          ? `$${(Number(mat.spool_cost) / Number(mat.spool_quantity)).toFixed(4)}/g`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs">{Array.isArray(mat.colors) ? mat.colors.join(', ') : mat.colors}</TableCell>
                      <TableCell>
                        <Switch
                          checked={mat.is_active}
                          onCheckedChange={() => handleToggleMaterialActive(mat.id, mat.is_active)}
                        />
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setCurrentMaterial({...mat});
                          setIsEditModalOpen(true);
                        }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => handleDeleteMaterial(mat.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {materials.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No materials found. Add one to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          
          <TabsContent value="settings">
            <div className="bg-card rounded-xl shadow-sm border border-border p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-foreground">Global Pricing Variables</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Botzen Formula: <code className="bg-muted px-1 rounded">FDM = (Y×M/L×A) + W×T</code> &nbsp;|&nbsp;
                  <code className="bg-muted px-1 rounded">SLA = (Y×M/V×B) + W×T</code>
                </p>
              </div>
              <div className="space-y-6 max-w-xl">
                {settings.map((setting) => {
                  const descriptions: Record<string, string> = {
                    material_multiplier_Y: 'Y — Material multiplier. Applied to raw material cost (e.g. 2.0 = 2× the material cost).',
                    run_time_multiplier_W: 'W — Run time multiplier in $/hour. Charged per hour of machine print time (e.g. 1.25 = $1.25/hr).',
                    max_file_size_mb: 'Maximum upload file size in megabytes.',
                  };
                  return (
                    <div key={setting.key} className="space-y-2">
                      <Label htmlFor={setting.key} className="font-medium text-foreground">
                        {setting.key.replace(/_/g, ' ')}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {descriptions[setting.key] ?? setting.description ?? ''}
                      </p>
                      <div className="flex gap-2">
                        <Input
                          id={setting.key}
                          defaultValue={setting.value}
                          onChange={(e) => {
                            const newSettings = [...settings];
                            const idx = newSettings.findIndex(s => s.key === setting.key);
                            newSettings[idx].value = e.target.value;
                            setSettings(newSettings);
                          }}
                        />
                        <Button onClick={() => handleSaveSetting(setting.key, setting.value)} className="flex items-center gap-2">
                          <Save className="w-4 h-4" /> Save
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {settings.length === 0 && (
                  <p className="text-muted-foreground">No settings found. Run fix_prices.sql in Supabase to seed them.</p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit / Add Material Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{currentMaterial?.isNew ? 'Add New Material' : `Edit — ${currentMaterial?.label}`}</DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Formula: <code className="bg-muted px-1 rounded">{currentMaterial?.type === 'SLA' ? 'Y × M/V × B' : 'Y × M/L × A'}</code>
            </p>
          </DialogHeader>
          {currentMaterial && (
            <form onSubmit={handleSaveMaterial} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mat-id">Material ID (unique, no spaces)</Label>
                  <Input
                    id="mat-id"
                    value={currentMaterial.id}
                    onChange={e => setCurrentMaterial({...currentMaterial, id: e.target.value})}
                    disabled={!currentMaterial.isNew}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mat-type">Print Type</Label>
                  <Select value={currentMaterial.type} onValueChange={v => setCurrentMaterial({...currentMaterial, type: v})}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FDM">FDM</SelectItem>
                      <SelectItem value="SLA">SLA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mat-label">Display Name</Label>
                  <Input
                    id="mat-label"
                    value={currentMaterial.label}
                    onChange={e => setCurrentMaterial({...currentMaterial, label: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mat-price-label">Description / Sub-label</Label>
                  <Input
                    id="mat-price-label"
                    value={currentMaterial.price_label}
                    onChange={e => setCurrentMaterial({...currentMaterial, price_label: e.target.value})}
                  />
                </div>
              </div>

              {/* Botzen Formula Variables */}
              <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
                <h3 className="text-sm font-semibold text-foreground">Botzen Formula Variables</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mat-spool-cost">M — Spool / Bottle Cost ($)</Label>
                    <p className="text-xs text-muted-foreground">Total purchase price of the spool or resin bottle</p>
                    <Input
                      id="mat-spool-cost"
                      type="number"
                      step="0.01"
                      value={currentMaterial.spool_cost ?? 0}
                      onChange={e => setCurrentMaterial({...currentMaterial, spool_cost: Number(e.target.value)})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mat-spool-qty">
                      Q — Material Quantity (grams)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Total quantity of material in grams (e.g., 1000g for a 1kg spool/bottle)
                    </p>
                    <Input
                      id="mat-spool-qty"
                      type="number"
                      step="1"
                      value={currentMaterial.spool_quantity ?? 0}
                      onChange={e => setCurrentMaterial({...currentMaterial, spool_quantity: Number(e.target.value)})}
                      required
                    />
                  </div>
                </div>
                {/* Live unit rate preview */}
                {currentMaterial.spool_quantity > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Unit rate (M/Q):{' '}
                    <strong className="text-foreground">
                      ${(Number(currentMaterial.spool_cost) / Number(currentMaterial.spool_quantity)).toFixed(5)}/g
                    </strong>
                  </p>
                )}
              </div>



              <div className="space-y-2 pt-2">
                <Label htmlFor="mat-colors">Available Colors (comma separated)</Label>
                <Input
                  id="mat-colors"
                  value={Array.isArray(currentMaterial.colors) ? currentMaterial.colors.join(', ') : ''}
                  onChange={e => {
                    const colors = e.target.value.split(',').map(c => c.trim()).filter(c => c);
                    setCurrentMaterial({...currentMaterial, colors});
                  }}
                  placeholder="e.g. Red, Blue, White, Black"
                />
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                <Button type="submit">Save Material</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
