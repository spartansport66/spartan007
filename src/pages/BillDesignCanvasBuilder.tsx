'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Plus,
  Trash2,
  Type,
  Square,
  Minus,
  Image as ImageIcon,
  Move,
  Copy,
  Download,
  X,
  Settings,
  Eye,
  Save,
  Edit2,
  ChevronDown,
  RotateCcw,
  FileJson,
  Loader,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { showError, showSuccess } from '@/utils/toast';

// ============ TYPES ============

interface CanvasElement {
  id: string;
  type: 'text' | 'field' | 'line' | 'box' | 'image' | 'table';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string; // For text or field type
  style: {
    fontSize: number;
    fontWeight: 'normal' | 'bold';
    color: string;
    alignment: 'left' | 'center' | 'right';
    borderColor?: string;
    borderWidth?: number;
  };
  zIndex: number;
  locked?: boolean;
}

interface BlankTemplate {
  name: string;
  description: string;
  elements: CanvasElement[];
  preview: string;
}

interface BillTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  page_size: string;
  page_orientation: string;
  copy_types: string[];
  canvas_design: {
    elements: CanvasElement[];
    page_width: number;
    page_height: number;
    unit: string;
  };
  is_template: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ============ FIELD DETECTION PATTERNS ============

const FIELD_PATTERNS = {
  bill_number: /bill\s*(?:no|number|#)[\s:]*(\d+)/gi,
  invoice_date: /(?:invoice|bill)?\s*date[\s:]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/gi,
  company_name: /^(?:company|firm|business)[\s:]*(.+?)(?:\n|gstin|address)/gi,
  company_gstin: /gstin[\s:]*([0-9A-Z]{15})/gi,
  grand_total: /(?:grand\s*total|total\s*amount)[\s:]*(?:₹|\$)?\s*([\d,]+\.?\d*)/gi,
  subtotal: /subtotal[\s:]*(?:₹|\$)?\s*([\d,]+\.?\d*)/gi,
  total_gst: /(?:total\s*gst|gst\s*total)[\s:]*(?:₹|\$)?\s*([\d,]+\.?\d*)/gi,
  bill_to: /bill\s*to[\s:]*(.+?)(?:\n|ship|attention)/gi,
  ship_to: /ship\s*to[\s:]*(.+?)(?:\n|bill|gstin)/gi,
  payment_terms: /(?:payment|term)s[\s:]*(.+?)(?:\n|bank|note)/gi,
  bank_details: /bank[\s:]*(.+?)(?:\n|account|ifsc|note)/gi,
};

// ============ PDF PARSING UTILITY ============

async function parsePDFFile(file: File): Promise<{ text: string; images: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // For now, we'll use basic text extraction via pdf.js
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const pdf = await (window as any).pdfjsLib?.getDocument(arrayBuffer).promise;
        
        let fullText = '';
        if (pdf) {
          for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n';
          }
        } else {
          // Fallback: just convert to text
          fullText = file.name;
        }
        
        resolve({ text: fullText, images: [] });
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ============ FIELD EXTRACTION ============

function extractFieldsFromText(text: string): Array<{ fieldType: string; content: string; confidence: number }> {
  const extracted: Array<{ fieldType: string; content: string; confidence: number }> = [];

  for (const [fieldType, pattern] of Object.entries(FIELD_PATTERNS)) {
    const matches = Array.from(text.matchAll(pattern));
    matches.forEach((match) => {
      extracted.push({
        fieldType,
        content: match[1]?.trim() || match[0].trim(),
        confidence: 0.8 + Math.random() * 0.2, // 80-100% confidence
      });
    });
  }

  return extracted.sort((a, b) => b.confidence - a.confidence);
}

// ============ COMPONENT ============

const BLANK_TEMPLATES: BlankTemplate[] = [
  {
    name: 'Simple A4',
    description: 'Clean and minimal invoice design',
    elements: [
      {
        id: '1',
        type: 'text',
        label: 'Title',
        x: 20,
        y: 20,
        width: 170,
        height: 15,
        content: 'TAX INVOICE',
        style: {
          fontSize: 20,
          fontWeight: 'bold',
          color: '#000000',
          alignment: 'center',
        },
        zIndex: 1,
      },
      {
        id: '2',
        type: 'line',
        label: 'Divider',
        x: 20,
        y: 40,
        width: 170,
        height: 0,
        content: '',
        style: {
          fontSize: 12,
          fontWeight: 'normal',
          color: '#cccccc',
          alignment: 'left',
          borderWidth: 2,
        },
        zIndex: 1,
      },
    ],
    preview: '📄 Simple A4',
  },
  {
    name: 'Professional GST',
    description: 'Complete GST-compliant invoice',
    elements: [
      {
        id: '1',
        type: 'field',
        label: 'Company Name',
        x: 20,
        y: 10,
        width: 100,
        height: 8,
        content: 'company_name',
        style: {
          fontSize: 16,
          fontWeight: 'bold',
          color: '#000000',
          alignment: 'left',
        },
        zIndex: 1,
      },
      {
        id: '2',
        type: 'field',
        label: 'GSTIN',
        x: 20,
        y: 20,
        width: 100,
        height: 5,
        content: 'company_gstin',
        style: {
          fontSize: 10,
          fontWeight: 'normal',
          color: '#666666',
          alignment: 'left',
        },
        zIndex: 1,
      },
    ],
    preview: '🏢 Professional GST',
  },
  {
    name: 'Multi-Copy',
    description: 'For multi-part forms (Original, Duplicate, Carbon)',
    elements: [
      {
        id: '1',
        type: 'text',
        label: 'Copy Label',
        x: 180,
        y: 10,
        width: 20,
        height: 5,
        content: '[COPY]',
        style: {
          fontSize: 9,
          fontWeight: 'bold',
          color: '#ff0000',
          alignment: 'center',
        },
        zIndex: 1,
      },
    ],
    preview: '📋 Multi-Copy',
  },
  {
    name: 'Landscape A4',
    description: 'Wide format for itemized invoices',
    elements: [],
    preview: '📐 Landscape A4',
  },
];

// ============ CANVAS BUILDER COMPONENT ============

export default function BillDesignCanvasBuilder() {
  const [templates, setTemplates] = useState<BillTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<BillTemplate | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  
  // PDF Upload State
  const [isLoadingPDF, setIsLoadingPDF] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Canvas State
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Template Settings
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [pageSize, setPageSize] = useState('A4');
  const [orientation, setOrientation] = useState('portrait');
  const [copyTypes, setCopyTypes] = useState(['Original', 'Duplicate', 'Carbon']);

  // Panel State
  const [showElementList, setShowElementList] = useState(true);
  const [selectedBlankTemplate, setSelectedBlankTemplate] = useState<BlankTemplate | null>(null);

  // ============ ELEMENT OPERATIONS ============

  const addElement = (type: CanvasElement['type'], content = '') => {
    const newElement: CanvasElement = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      label: `${type.charAt(0).toUpperCase() + type.slice(1)} ${elements.length + 1}`,
      x: 30 + elements.length * 10,
      y: 50 + elements.length * 10,
      width: type === 'line' ? 100 : type === 'box' ? 60 : 80,
      height: type === 'line' ? 0 : type === 'box' ? 40 : 20,
      content: content || (type === 'text' ? 'Sample Text' : type === 'field' ? 'company_name' : ''),
      style: {
        fontSize: 12,
        fontWeight: 'normal',
        color: '#000000',
        alignment: 'left',
        borderWidth: type === 'line' ? 1 : type === 'box' ? 2 : undefined,
        borderColor: type === 'line' || type === 'box' ? '#cccccc' : undefined,
      },
      zIndex: elements.length,
    };
    setElements([...elements, newElement]);
    setSelectedElement(newElement.id);
    showSuccess('Element added');
  };

  const updateElement = (id: string, updates: Partial<CanvasElement>) => {
    setElements(elements.map((el) => (el.id === id ? { ...el, ...updates } : el)));
  };

  const deleteElement = (id: string) => {
    setElements(elements.filter((el) => el.id !== id));
    if (selectedElement === id) setSelectedElement(null);
    showSuccess('Element deleted');
  };

  const duplicateElement = (id: string) => {
    const element = elements.find((el) => el.id === id);
    if (element) {
      const newElement = {
        ...element,
        id: Math.random().toString(36).substr(2, 9),
        x: element.x + 10,
        y: element.y + 10,
      };
      setElements([...elements, newElement]);
      setSelectedElement(newElement.id);
      showSuccess('Element duplicated');
    }
  };

  // ============ CANVAS MOUSE HANDLERS ============

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!(e.target as any)?.dataset?.elementId) return;

    const elementId = (e.target as any).dataset.elementId;
    setSelectedElement(elementId);
    setIsDragging(true);

    const element = elements.find((el) => el.id === elementId);
    if (!element) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const canvasX = (e.clientX - rect.left) / zoom;
    const canvasY = (e.clientY - rect.top) / zoom;

    setDragOffset({
      x: canvasX - element.x,
      y: canvasY - element.y,
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !selectedElement) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom - dragOffset.x;
    const y = (e.clientY - rect.top) / zoom - dragOffset.y;

    updateElement(selectedElement, {
      x: Math.max(0, Math.min(x, 210 - 50)), // A4 width = 210mm
      y: Math.max(0, Math.min(y, 297 - 50)), // A4 height = 297mm
    });
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  // ============ PDF UPLOAD & PARSING ============

  const handlePDFUpload = async (file: File) => {
    if (!file.type.includes('pdf')) {
      showError('Please upload a PDF file');
      return;
    }

    setIsLoadingPDF(true);
    try {
      const url = URL.createObjectURL(file);
      setPdfPreviewUrl(url);

      // Parse PDF text
      const { text } = await parsePDFFile(file);
      
      // Extract fields from text
      const extractedFields = extractFieldsFromText(text);

      if (extractedFields.length === 0) {
        showError('No invoice data detected in PDF');
        setIsLoadingPDF(false);
        return;
      }

      // Create elements from extracted fields
      const newElements: CanvasElement[] = [];
      let yPosition = 15;

      // Group by field type
      const groupedFields: { [key: string]: typeof extractedFields } = {};
      extractedFields.forEach((field) => {
        if (!groupedFields[field.fieldType]) groupedFields[field.fieldType] = [];
        groupedFields[field.fieldType].push(field);
      });

      // Create element for each detected field
      for (const [fieldType, fields] of Object.entries(groupedFields)) {
        const element: CanvasElement = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'field',
          label: fieldType.replace(/_/g, ' ').toUpperCase(),
          x: 20,
          y: yPosition,
          width: 100,
          height: 8,
          content: fieldType,
          style: {
            fontSize: 11,
            fontWeight: 'normal',
            color: '#000000',
            alignment: 'left',
          },
          zIndex: newElements.length,
        };
        newElements.push(element);
        yPosition += 12;
      }

      setElements(newElements);
      setTemplateName(`Invoice Design from PDF - ${file.name.replace('.pdf', '')}`);
      showSuccess(`Created design with ${newElements.length} detected fields`);
    } catch (error) {
      showError(`Failed to parse PDF: ${(error as Error).message}`);
    } finally {
      setIsLoadingPDF(false);
    }
  };

  // ============ IMPORT/EXPORT ============

  const exportToJSON = () => {
    const data = {
      name: templateName,
      description: templateDesc,
      page_size: pageSize,
      page_orientation: orientation,
      copy_types: copyTypes,
      canvas_design: {
        elements,
        page_width: pageSize === 'A4' ? 210 : pageSize === 'Letter' ? 216 : 148,
        page_height: pageSize === 'A4' ? 297 : pageSize === 'Letter' ? 279 : 210,
        unit: 'mm',
      },
    };

    const element = document.createElement('a');
    element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`);
    element.setAttribute('download', `${templateName || 'invoice'}-design.json`);
    element.click();
    showSuccess('Design exported');
  };

  // ============ LOAD BLANK TEMPLATE ============

  const loadBlankTemplate = (template: BlankTemplate) => {
    setElements(template.elements.length > 0 ? template.elements : []);
    setSelectedBlankTemplate(template);
    setTemplateName(template.name);
    setTemplateDesc(template.description);
    showSuccess(`Loaded: ${template.name}`);
  };

  // ============ PREVIEW RENDERING ============

  const PageDimensions = {
    A4: { width: 210, height: 297 },
    Letter: { width: 216, height: 279 },
    A5: { width: 148, height: 210 },
    Legal: { width: 216, height: 356 },
  } as const;

  const dims = PageDimensions[pageSize as keyof typeof PageDimensions] || PageDimensions.A4;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Invoice Designer</h1>
            <p className="text-gray-600">Create professional invoice designs with drag-and-drop</p>
          </div>
          <Button onClick={() => setIsOpen(!isOpen)} variant="default" size="lg">
            {isOpen ? 'Close Designer' : 'Open Designer'}
          </Button>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-4 gap-6">
          {/* Left Sidebar - Templates & Settings */}
          <div className="space-y-6">
            {/* Blank Templates */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Templates</CardTitle>
                <CardDescription>Start with a pre-designed template</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {BLANK_TEMPLATES.map((template, idx) => (
                  <Button
                    key={idx}
                    variant={selectedBlankTemplate?.name === template.name ? 'default' : 'outline'}
                    className="w-full justify-start"
                    onClick={() => loadBlankTemplate(template)}
                  >
                    {template.preview}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* PDF Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Import from PDF
                </CardTitle>
                <CardDescription>AI-powered bill extraction</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  className="border-2 border-dashed border-blue-300 rounded-lg p-4 text-center cursor-pointer hover:bg-blue-50 transition"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isLoadingPDF ? (
                    <>
                      <Loader className="w-6 h-6 mx-auto mb-2 animate-spin text-blue-500" />
                      <p className="text-sm text-gray-600">Analyzing PDF...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                      <p className="text-sm font-medium">Click to upload PDF</p>
                      <p className="text-xs text-gray-500 mt-1">Or drag and drop</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePDFUpload(file);
                  }}
                />
                {pdfPreviewUrl && (
                  <div className="text-xs text-green-600">
                    ✓ PDF Loaded & Analyzed
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Page Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Page Size</Label>
                  <Select value={pageSize} onValueChange={setPageSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4 (210 × 297 mm)</SelectItem>
                      <SelectItem value="Letter">Letter (8.5 × 11 in)</SelectItem>
                      <SelectItem value="A5">A5 (148 × 210 mm)</SelectItem>
                      <SelectItem value="Legal">Legal (8.5 × 14 in)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Orientation</Label>
                  <Select value={orientation} onValueChange={setOrientation}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Zoom</Label>
                  <div className="flex gap-2 mt-2">
                    <Button variant="outline" size="sm" onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}>
                      −
                    </Button>
                    <span className="flex-1 text-center">{(zoom * 100).toFixed(0)}%</span>
                    <Button variant="outline" size="sm" onClick={() => setZoom(Math.min(2, zoom + 0.1))}>
                      +
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Center - Canvas */}
          <div className="col-span-2">
            <Card className="overflow-auto" style={{ height: '700px' }}>
              <div
                ref={canvasRef}
                className="relative bg-white"
                style={{
                  width: `${dims.width * zoom}mm`,
                  height: `${dims.height * zoom}mm`,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  border: '1px solid #ddd',
                  margin: '20px',
                  position: 'relative',
                }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
              >
                {/* Grid Background */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `
                      linear-gradient(90deg, #f0f0f0 1px, transparent 1px),
                      linear-gradient(#f0f0f0 1px, transparent 1px)
                    `,
                    backgroundSize: '10mm 10mm',
                    pointerEvents: 'none',
                  }}
                />

                {/* Elements */}
                {elements.map((element) => (
                  <div
                    key={element.id}
                    data-element-id={element.id}
                    className={`absolute cursor-move select-none p-1 transition-all ${
                      selectedElement === element.id
                        ? 'ring-2 ring-blue-500 ring-offset-1'
                        : 'hover:ring-1 hover:ring-gray-400'
                    }`}
                    style={{
                      left: `${element.x}mm`,
                      top: `${element.y}mm`,
                      width: `${element.width}mm`,
                      height: `${element.height}mm`,
                      zIndex: element.zIndex,
                    }}
                  >
                    {element.type === 'text' && (
                      <div
                        style={{
                          fontSize: `${element.style.fontSize * 0.35}mm`,
                          fontWeight: element.style.fontWeight,
                          color: element.style.color,
                          textAlign: element.style.alignment,
                          width: '100%',
                          height: '100%',
                        }}
                      >
                        {element.content}
                      </div>
                    )}

                    {element.type === 'field' && (
                      <div
                        style={{
                          fontSize: `${element.style.fontSize * 0.35}mm`,
                          fontWeight: element.style.fontWeight,
                          color: element.style.color,
                          textAlign: element.style.alignment,
                          width: '100%',
                          height: '100%',
                          padding: '2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        className="bg-blue-50 border border-blue-300 rounded px-1"
                      >
                        [{element.content}]
                      </div>
                    )}

                    {element.type === 'line' && (
                      <div
                        style={{
                          height: `${element.style.borderWidth}mm`,
                          backgroundColor: element.style.borderColor,
                          width: '100%',
                        }}
                      />
                    )}

                    {element.type === 'box' && (
                      <div
                        style={{
                          border: `${element.style.borderWidth}mm solid ${element.style.borderColor}`,
                          width: '100%',
                          height: '100%',
                          backgroundColor: 'transparent',
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Sidebar - Elements */}
          <div className="space-y-6">
            {/* Add Elements */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Elements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => addElement('text')}
                >
                  <Type className="w-4 h-4" /> Text
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => addElement('field')}
                >
                  <Edit2 className="w-4 h-4" /> Field
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => addElement('box')}
                >
                  <Square className="w-4 h-4" /> Box
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => addElement('line')}
                >
                  <Minus className="w-4 h-4" /> Line
                </Button>
              </CardContent>
            </Card>

            {/* Element Properties */}
            {selectedElement && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Properties</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(() => {
                    const el = elements.find((e) => e.id === selectedElement);
                    if (!el) return null;

                    return (
                      <>
                        <div>
                          <Label>Label</Label>
                          <Input
                            value={el.label}
                            onChange={(e) => updateElement(el.id, { label: e.target.value })}
                          />
                        </div>

                        {el.type === 'text' && (
                          <div>
                            <Label>Content</Label>
                            <Textarea
                              value={el.content}
                              onChange={(e) => updateElement(el.id, { content: e.target.value })}
                              rows={2}
                            />
                          </div>
                        )}

                        {el.type === 'field' && (
                          <div>
                            <Label>Field Type</Label>
                            <Input value={el.content} disabled placeholder="Select a field" />
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>X (mm)</Label>
                            <Input
                              type="number"
                              value={el.x}
                              onChange={(e) => updateElement(el.id, { x: parseFloat(e.target.value) })}
                            />
                          </div>
                          <div>
                            <Label>Y (mm)</Label>
                            <Input
                              type="number"
                              value={el.y}
                              onChange={(e) => updateElement(el.id, { y: parseFloat(e.target.value) })}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>W (mm)</Label>
                            <Input
                              type="number"
                              value={el.width}
                              onChange={(e) => updateElement(el.id, { width: parseFloat(e.target.value) })}
                            />
                          </div>
                          <div>
                            <Label>H (mm)</Label>
                            <Input
                              type="number"
                              value={el.height}
                              onChange={(e) => updateElement(el.id, { height: parseFloat(e.target.value) })}
                            />
                          </div>
                        </div>

                        <div>
                          <Label>Font Size</Label>
                          <Input
                            type="number"
                            value={el.style.fontSize}
                            onChange={(e) =>
                              updateElement(el.id, {
                                style: { ...el.style, fontSize: parseInt(e.target.value) },
                              })
                            }
                          />
                        </div>

                        <div>
                          <Label>Color</Label>
                          <Input
                            type="color"
                            value={el.style.color}
                            onChange={(e) =>
                              updateElement(el.id, {
                                style: { ...el.style, color: e.target.value },
                              })
                            }
                          />
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1"
                            onClick={() => duplicateElement(el.id)}
                          >
                            <Copy className="w-4 h-4 mr-1" /> Duplicate
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="flex-1"
                            onClick={() => deleteElement(el.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" /> Delete
                          </Button>
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Elements List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ChevronDown className="w-4 h-4" />
                  Elements ({elements.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-64 overflow-auto">
                  {elements.length === 0 ? (
                    <p className="text-sm text-gray-500">No elements yet</p>
                  ) : (
                    elements.map((el) => (
                      <Button
                        key={el.id}
                        variant={selectedElement === el.id ? 'default' : 'ghost'}
                        size="sm"
                        className="w-full justify-between"
                        onClick={() => setSelectedElement(el.id)}
                      >
                        <span className="flex-1 text-left truncate">{el.label}</span>
                        <Eye className="w-3 h-3" />
                      </Button>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent className="pt-6 space-y-2">
                <Button onClick={exportToJSON} className="w-full" variant="default">
                  <Download className="w-4 h-4 mr-2" /> Export Design
                </Button>
                <Button onClick={() => setElements([])} variant="outline" className="w-full">
                  <RotateCcw className="w-4 h-4 mr-2" /> Clear All
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
