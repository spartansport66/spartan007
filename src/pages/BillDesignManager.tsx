"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { Loader2, Plus, Edit, Trash2, Eye, Save, X, Copy, Check, AlertCircle, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';

interface BillDesignTemplate {
  id: string;
  name: string;
  description: string;
  company_id: string;
  company_name: string;
  template_design: any;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}

interface AvailableField {
  id: string;
  section_id: string;
  field_type: string;
  field_label: string;
  description: string;
  default_style: any;
  is_required: boolean;
}

interface DesignSection {
  id: string;
  name: string;
  position: number;
  visible: boolean;
  fields: any[];
}

interface DesignField {
  id: string;
  field_type: string;
  field_label: string;
  visible: boolean;
  style: any;
  description: string;
}

export default function BillDesignManager() {
  const navigate = useNavigate();
  const { user, isAdmin } = useSession();
  
  const [templates, setTemplates] = useState<BillDesignTemplate[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [availableFields, setAvailableFields] = useState<AvailableField[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  
  // Form states
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<BillDesignTemplate | null>(null);
  const [editingSections, setEditingSections] = useState<DesignSection[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['header', 'bill_details', 'items_table', 'totals', 'terms', 'signature']));

  useEffect(() => {
    if (!isAdmin) {
      navigate('/admin-dashboard');
    } else {
      fetchData();
    }
  }, [isAdmin, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name')
        .order('name');
      
      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);
      if (companiesData && companiesData.length > 0) {
        setSelectedCompanyId(companiesData[0].id);
      }

      const { data: fieldsData, error: fieldsError } = await supabase
        .from('bill_design_available_fields')
        .select('*')
        .order('section_id, display_order');
      
      if (fieldsError) throw fieldsError;
      setAvailableFields(fieldsData || []);

      if (companiesData && companiesData.length > 0) {
        fetchTemplates(companiesData[0].id);
      }
    } catch (err: any) {
      showError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('bill_design_templates')
        .select('*, companies(name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const processed = (data || []).map((t: any) => ({
        ...t,
        company_name: t.companies?.name || 'N/A',
      }));

      setTemplates(processed);
    } catch (err: any) {
      showError(`Failed to fetch templates: ${err.message}`);
    }
  };

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
    fetchTemplates(companyId);
  };

  const createBlankTemplate = () => {
    return {
      sections: [
        { id: 'header', name: 'Header', position: 1, visible: true, fields: [] },
        { id: 'bill_details', name: 'Bill Details', position: 2, visible: true, fields: [] },
        { id: 'items_table', name: 'Items Table', position: 3, visible: true, fields: [] },
        { id: 'totals', name: 'Totals Section', position: 4, visible: true, fields: [] },
        { id: 'terms', name: 'Terms & Conditions', position: 5, visible: true, fields: [] },
        { id: 'signature', name: 'Signature/Authorization', position: 6, visible: true, fields: [] },
      ]
    };
  };

  const handleStartCreating = () => {
    setSelectedTemplate(null);
    setEditingSections(createBlankTemplate().sections);
    setIsEditorOpen(true);
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      showError('Please enter a template name');
      return;
    }

    if (!selectedCompanyId) {
      showError('Please select a company');
      return;
    }

    setSavingTemplate(true);
    try {
      const { data, error } = await supabase
        .from('bill_design_templates')
        .insert({
          name: newTemplateName,
          description: newTemplateDescription,
          company_id: selectedCompanyId,
          template_design: { sections: editingSections },
          created_by: user?.id,
        })
        .select();

      if (error) throw error;

      showSuccess('Template created successfully!');
      setNewTemplateName('');
      setNewTemplateDescription('');
      setIsCreateDialogOpen(false);
      setIsEditorOpen(false);
      fetchTemplates(selectedCompanyId);
    } catch (err: any) {
      showError(`Failed to create template: ${err.message}`);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleEditTemplate = (template: BillDesignTemplate) => {
    setSelectedTemplate(template);
    setEditingSections(template.template_design.sections);
    setIsEditorOpen(true);
  };

  const handleToggleSectionExpanded = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const handleToggleFieldVisibility = (sectionId: string, fieldIndex: number) => {
    setEditingSections(prevSections =>
      prevSections.map(section =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.map((f, i) =>
                i === fieldIndex ? { ...f, visible: !f.visible } : f
              )
            }
          : section
      )
    );
  };

  const handleAddFieldToSection = (sectionId: string, field: AvailableField) => {
    setEditingSections(prevSections =>
      prevSections.map(section =>
        section.id === sectionId
          ? {
              ...section,
              fields: [
                ...section.fields,
                {
                  id: field.id,
                  field_type: field.field_type,
                  field_label: field.field_label,
                  visible: true,
                  style: field.default_style || {},
                  description: field.description,
                }
              ]
            }
          : section
      )
    );
  };

  const handleRemoveFieldFromSection = (sectionId: string, fieldIndex: number) => {
    setEditingSections(prevSections =>
      prevSections.map(section =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.filter((_, i) => i !== fieldIndex)
            }
          : section
      )
    );
  };

  const handleMoveFieldUp = (sectionId: string, fieldIndex: number) => {
    if (fieldIndex === 0) return;
    setEditingSections(prevSections =>
      prevSections.map(section =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.map((f, i) => {
                if (i === fieldIndex - 1) return section.fields[fieldIndex];
                if (i === fieldIndex) return section.fields[fieldIndex - 1];
                return f;
              })
            }
          : section
      )
    );
  };

  const handleMoveFieldDown = (sectionId: string, fieldIndex: number, totalFields: number) => {
    if (fieldIndex === totalFields - 1) return;
    setEditingSections(prevSections =>
      prevSections.map(section =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.map((f, i) => {
                if (i === fieldIndex + 1) return section.fields[fieldIndex];
                if (i === fieldIndex) return section.fields[fieldIndex + 1];
                return f;
              })
            }
          : section
      )
    );
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      showError('Please enter a template name');
      return;
    }

    setSavingTemplate(true);
    try {
      if (selectedTemplate) {
        // Update existing
        const { error } = await supabase
          .from('bill_design_templates')
          .update({
            template_design: { sections: editingSections },
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedTemplate.id);

        if (error) throw error;
        showSuccess('Template updated successfully!');
      } else {
        // Create new
        await handleCreateTemplate();
        return;
      }

      setIsEditorOpen(false);
      fetchTemplates(selectedCompanyId);
    } catch (err: any) {
      showError(`Failed to save template: ${err.message}`);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSetDefault = async (templateId: string) => {
    try {
      await supabase
        .from('bill_design_templates')
        .update({ is_default: false })
        .eq('company_id', selectedCompanyId)
        .eq('is_default', true);

      const { error } = await supabase
        .from('bill_design_templates')
        .update({ is_default: true })
        .eq('id', templateId);

      if (error) throw error;

      showSuccess('Default template updated!');
      fetchTemplates(selectedCompanyId);
    } catch (err: any) {
      showError(`Failed to update default: ${err.message}`);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('bill_design_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      showSuccess('Template deleted successfully!');
      fetchTemplates(selectedCompanyId);
    } catch (err: any) {
      showError(`Failed to delete template: ${err.message}`);
    }
  };

  const getSectionFields = (sectionId: string) => {
    return availableFields.filter(f => f.section_id === sectionId);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Bill Design Templates</h1>
            <p className="text-muted-foreground">Create and customize bill formats for your companies</p>
          </div>
          <Button onClick={handleStartCreating} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> New Template
          </Button>
        </div>

        {/* Company Filter */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="company" className="mb-2 block">Select Company/Warehouse</Label>
                <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                  <SelectTrigger id="company">
                    <SelectValue placeholder="Choose company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map(company => (
                      <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Templates List */}
        <Card>
          <CardHeader>
            <CardTitle>Bill Design Templates</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No bill design templates yet for this company.</p>
                <p className="text-sm mt-2">Create one to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map(template => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {template.description || '—'}
                        </TableCell>
                        <TableCell>
                          {template.is_default ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <Check className="h-4 w-4" /> Default
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetDefault(template.id)}
                              className="text-xs"
                            >
                              Set Default
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <Checkbox checked={template.is_active} readOnly />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(template.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditTemplate(template)}
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="Delete">
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Template?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{template.name}"? This cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteTemplate(template.id)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Template Editor Dialog */}
      {isEditorOpen && (
        <BillDesignEditorFull
          template={selectedTemplate}
          templateName={selectedTemplate ? selectedTemplate.name : newTemplateName}
          setTemplateName={selectedTemplate ? undefined : setNewTemplateName}
          templateDescription={selectedTemplate ? selectedTemplate.description : newTemplateDescription}
          setTemplateDescription={selectedTemplate ? undefined : setNewTemplateDescription}
          sections={editingSections}
          availableFields={availableFields}
          onSave={handleSaveTemplate}
          onClose={() => {
            setIsEditorOpen(false);
            setNewTemplateName('');
            setNewTemplateDescription('');
          }}
          onToggleFieldVisibility={handleToggleFieldVisibility}
          onAddField={handleAddFieldToSection}
          onRemoveField={handleRemoveFieldFromSection}
          onMoveFieldUp={handleMoveFieldUp}
          onMoveFieldDown={handleMoveFieldDown}
          saving={savingTemplate}
          expandedSections={expandedSections}
          onToggleSectionExpanded={handleToggleSectionExpanded}
        />
      )}
    </div>
  );
}

// Enhanced Bill Design Editor Component with Full Preview
function BillDesignEditorFull({
  template,
  templateName,
  setTemplateName,
  templateDescription,
  setTemplateDescription,
  sections,
  availableFields,
  onSave,
  onClose,
  onToggleFieldVisibility,
  onAddField,
  onRemoveField,
  onMoveFieldUp,
  onMoveFieldDown,
  saving,
  expandedSections,
  onToggleSectionExpanded,
}: {
  template: any;
  templateName: string;
  setTemplateName?: (name: string) => void;
  templateDescription: string;
  setTemplateDescription?: (desc: string) => void;
  sections: DesignSection[];
  availableFields: AvailableField[];
  onSave: () => Promise<void>;
  onClose: () => void;
  onToggleFieldVisibility: (sectionId: string, fieldIndex: number) => void;
  onAddField: (sectionId: string, field: AvailableField) => void;
  onRemoveField: (sectionId: string, fieldIndex: number) => void;
  onMoveFieldUp: (sectionId: string, fieldIndex: number) => void;
  onMoveFieldDown: (sectionId: string, fieldIndex: number, total: number) => void;
  saving: boolean;
  expandedSections: Set<string>;
  onToggleSectionExpanded: (sectionId: string) => void;
}) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{template ? `Edit Template: ${template.name}` : 'Create New Bill Design Template'}</DialogTitle>
          <DialogDescription>
            Design your bill format by adding and arranging fields
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-4 min-h-0">
          {/* Left Section: Template Info & Fields */}
          <div className="col-span-1 space-y-4 overflow-y-auto pr-4">
            {!template && (
              <>
                <div>
                  <Label htmlFor="tpl-name" className="text-sm font-semibold">Template Name</Label>
                  <Input
                    id="tpl-name"
                    placeholder="e.g., Standard Invoice"
                    value={templateName}
                    onChange={(e) => setTemplateName?.(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="tpl-desc" className="text-sm font-semibold">Description</Label>
                  <Textarea
                    id="tpl-desc"
                    placeholder="Describe this template..."
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription?.(e.target.value)}
                    rows={2}
                    className="mt-1"
                  />
                </div>
              </>
            )}

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">Design Sections</h3>
              <div className="space-y-2">
                {sections.map(section => (
                  <div key={section.id} className="border rounded-lg overflow-hidden bg-background">
                    <button
                      onClick={() => onToggleSectionExpanded(section.id)}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted text-left"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-sm font-semibold">{section.name}</span>
                        <span className="text-xs text-muted-foreground">({section.fields.length} fields)</span>
                      </div>
                      {expandedSections.has(section.id) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>

                    {expandedSections.has(section.id) && (
                      <div className="border-t bg-muted/30 p-3 space-y-2">
                        {/* Added Fields */}
                        {section.fields.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">No fields added</p>
                        ) : (
                          <div className="space-y-1">
                            {section.fields.map((field, idx) => (
                              <div
                                key={`${section.id}-${idx}`}
                                className="flex items-center gap-2 p-2 bg-background rounded border text-xs hover:bg-muted group"
                              >
                                <GripVertical className="h-3 w-3 text-muted-foreground" />
                                <Checkbox
                                  checked={field.visible}
                                  onCheckedChange={() => onToggleFieldVisibility(section.id, idx)}
                                  className="h-3 w-3"
                                />
                                <span className="flex-1 truncate">{field.field_label}</span>
                                <div className="hidden group-hover:flex gap-1">
                                  <button
                                    onClick={() => onMoveFieldUp(section.id, idx)}
                                    disabled={idx === 0}
                                    className="p-1 hover:bg-accent disabled:opacity-50"
                                  >
                                    <ChevronUp className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => onMoveFieldDown(section.id, idx, section.fields.length)}
                                    disabled={idx === section.fields.length - 1}
                                    className="p-1 hover:bg-accent disabled:opacity-50"
                                  >
                                    <ChevronDown className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => onRemoveField(section.id, idx)}
                                    className="p-1 hover:bg-destructive/20 text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Available Fields to Add */}
                        <div className="border-t pt-2 mt-2">
                          <p className="text-xs font-semibold mb-1 text-muted-foreground">Add Fields:</p>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {availableFields
                              .filter(f => f.section_id === section.id)
                              .map(field => {
                                const exists = section.fields.some(f => f.field_type === field.field_type);
                                return (
                                  <button
                                    key={field.id}
                                    onClick={() => !exists && onAddField(section.id, field)}
                                    disabled={exists}
                                    className="w-full text-left px-2 py-1 text-xs rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed bg-muted"
                                  >
                                    + {field.field_label}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Section: Live Preview */}
          <div className="col-span-2 overflow-y-auto">
            <div className="bg-white border rounded-lg p-8 shadow-sm space-y-6 min-h-full">
              <div className="text-center text-sm text-muted-foreground mb-4">
                📄 LIVE PREVIEW
              </div>

              {sections.map(section => (
                section.visible && section.fields.filter(f => f.visible).length > 0 && (
                  <div key={section.id} className="border-b pb-4">
                    <h2 className="font-bold text-sm mb-2 uppercase tracking-wide">{section.name}</h2>
                    <div className="space-y-1 text-xs">
                      {section.fields.map((field, idx) => (
                        field.visible && (
                          <div
                            key={idx}
                            style={{
                              fontSize: field.style?.fontSize || 12,
                              fontWeight: field.style?.fontWeight || 'normal',
                              color: field.style?.color || '#000',
                              textAlign: field.style?.alignment || 'left',
                            }}
                            className="py-1"
                          >
                            <span className="font-semibold">{field.field_label}:</span> [Sample Data]
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )
              ))}

              <div className="mt-6 text-center text-xs text-muted-foreground">
                Adjust fields on the left to see changes here
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 border-t pt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {template ? 'Update Template' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
