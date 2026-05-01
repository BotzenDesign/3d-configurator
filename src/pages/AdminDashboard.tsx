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
      if (currentMaterial.isNew) {
        const { isNew, ...dataToInsert } = currentMaterial;
        const { error } = await supabase.from('materials').insert([dataToInsert]);
        if (error) throw error;
        toast.success('Material created');
      } else {
        const { error } = await supabase
          .from('materials')
          .update({
            label: currentMaterial.label,
            price_label: currentMaterial.price_label,
            type: currentMaterial.type,
            density_gcm3: currentMaterial.density_gcm3,
            cost_per_gram: currentMaterial.cost_per_gram,
            colors: currentMaterial.colors,
          })
          .eq('id', currentMaterial.id);
        if (error) throw error;
        toast.success('Material updated');
      }
      setIsEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error('Failed to save material: ' + err.message);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-sm text-gray-500">Manage 3D Configurator Pricing & Materials</p>
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
                  density_gcm3: 1.0,
                  cost_per_gram: 0.05,
                  colors: [],
                  is_active: true,
                  isNew: true
                });
                setIsEditModalOpen(true);
              }} className="flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Material
              </Button>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Density (g/cm³)</TableHead>
                    <TableHead>Cost/Gram ($)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.map((mat) => (
                    <TableRow key={mat.id}>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${mat.type === 'SLA' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {mat.type}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{mat.id}</TableCell>
                      <TableCell>{mat.label}</TableCell>
                      <TableCell>{mat.density_gcm3}</TableCell>
                      <TableCell>${Number(mat.cost_per_gram).toFixed(3)}</TableCell>
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
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No materials found. Add one to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          
          <TabsContent value="settings">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4">Global Pricing Configuration</h2>
              <div className="space-y-6 max-w-xl">
                {settings.map((setting) => (
                  <div key={setting.key} className="space-y-2">
                    <Label htmlFor={setting.key} className="font-medium capitalize">
                      {setting.key.replace(/_/g, ' ')}
                    </Label>
                    <p className="text-sm text-gray-500 mb-2">{setting.description}</p>
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
                ))}
                {settings.length === 0 && (
                  <p className="text-gray-500">No settings found in the database.</p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Material Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{currentMaterial?.isNew ? 'Add New Material' : 'Edit Material'}</DialogTitle>
          </DialogHeader>
          {currentMaterial && (
            <form onSubmit={handleSaveMaterial} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mat-id">Material ID (Unique, No Spaces)</Label>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
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

                <div className="space-y-2">
                  <Label htmlFor="mat-density">Density (g/cm³)</Label>
                  <Input 
                    id="mat-density" 
                    type="number" 
                    step="0.01"
                    value={currentMaterial.density_gcm3} 
                    onChange={e => setCurrentMaterial({...currentMaterial, density_gcm3: Number(e.target.value)})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mat-cost">Cost Per Gram ($)</Label>
                  <Input 
                    id="mat-cost" 
                    type="number" 
                    step="0.001"
                    value={currentMaterial.cost_per_gram} 
                    onChange={e => setCurrentMaterial({...currentMaterial, cost_per_gram: Number(e.target.value)})}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="mat-colors">Available Colors (Comma Separated)</Label>
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
