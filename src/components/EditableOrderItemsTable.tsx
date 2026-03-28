import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Edit2, Check, X } from 'lucide-react';

interface OrderItemWithPrice {
  id: string;
  product_id?: string;
  combo_id?: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  gst_percent: number;
  taxable_value?: number;
  gst_amount?: number;
  total_price: number;
}

interface EditableOrderItemsTableProps {
  items: OrderItemWithPrice[];
  isSubmitting?: boolean;
  onUpdateItem: (id: string, field: string, value: any) => void;
  onRemoveItem: (id: string) => void;
}

const EditableOrderItemsTable: React.FC<EditableOrderItemsTableProps> = ({
  items,
  isSubmitting = false,
  onUpdateItem,
  onRemoveItem,
}) => {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValues, setEditValues] = React.useState<Record<string, any>>({});

  const startEdit = (item: OrderItemWithPrice) => {
    setEditingId(item.id);
    setEditValues({
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_percent: item.discount_percent,
      gst_percent: item.gst_percent,
    });
  };

  const saveEdit = (id: string) => {
    Object.entries(editValues).forEach(([field, value]) => {
      onUpdateItem(id, field, value);
    });
    setEditingId(null);
    setEditValues({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const calculateTotal = (
    unitPrice: number,
    qty: number,
    discount: number,
    gst: number
  ): number => {
    const discountedPrice = unitPrice * (1 - discount / 100);
    const taxableValue = discountedPrice * qty;
    const gstAmount = (taxableValue * gst) / 100;
    return taxableValue + gstAmount;
  };

  if (items.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground border rounded-md">
        No items in this order
      </div>
    );
  }

  return (
    <div className="max-h-[400px] overflow-y-auto border rounded-md">
      <Table>
        <TableHeader className="sticky top-0 bg-muted">
          <TableRow>
            <TableHead className="min-w-[200px]">Product</TableHead>
            <TableHead className="w-20 text-center">Qty</TableHead>
            <TableHead className="w-24 text-center">Unit Price</TableHead>
            <TableHead className="w-20 text-center">Disc %</TableHead>
            <TableHead className="w-20 text-center">GST %</TableHead>
            <TableHead className="w-24 text-right">Total</TableHead>
            <TableHead className="w-16 text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const isEditing = editingId === item.id;
            const currentQty = isEditing ? editValues.quantity : item.quantity;
            const currentPrice = isEditing ? editValues.unit_price : item.unit_price;
            const currentDisc = isEditing ? editValues.discount_percent : item.discount_percent;
            const currentGst = isEditing ? editValues.gst_percent : item.gst_percent;
            const total = calculateTotal(currentPrice, currentQty, currentDisc, currentGst);

            return (
              <TableRow key={item.id} className={isEditing ? 'bg-blue-50' : ''}>
                <TableCell className="font-medium">
                  {item.product_name}
                  <div className="text-xs text-muted-foreground">Code: {item.product_code}</div>
                  {item.combo_id && (
                    <div className="text-xs text-blue-600 font-semibold">From Combo</div>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {isEditing ? (
                    <Input
                      type="number"
                      value={editValues.quantity}
                      onChange={(e) =>
                        setEditValues({ ...editValues, quantity: parseInt(e.target.value) || 0 })
                      }
                      min="1"
                      className="h-8 text-center"
                    />
                  ) : (
                    currentQty
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {isEditing ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={editValues.unit_price}
                      onChange={(e) =>
                        setEditValues({ ...editValues, unit_price: parseFloat(e.target.value) || 0 })
                      }
                      className="h-8 text-center"
                    />
                  ) : (
                    `₹${currentPrice.toFixed(2)}`
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {isEditing ? (
                    <Input
                      type="number"
                      step="0.1"
                      value={editValues.discount_percent}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          discount_percent: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-8 text-center"
                      min="0"
                      max="100"
                    />
                  ) : (
                    `${currentDisc.toFixed(1)}%`
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {isEditing ? (
                    <Input
                      type="number"
                      step="0.1"
                      value={editValues.gst_percent}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          gst_percent: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-8 text-center"
                      min="0"
                    />
                  ) : (
                    `${currentGst.toFixed(1)}%`
                  )}
                </TableCell>
                <TableCell className="text-right font-bold text-green-600">₹{total.toFixed(2)}</TableCell>
                <TableCell className="text-center space-x-1">
                  {isEditing ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-600"
                        onClick={() => saveEdit(item.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600"
                        onClick={cancelEdit}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => startEdit(item)}
                        disabled={isSubmitting}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => onRemoveItem(item.id)}
                        disabled={isSubmitting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default EditableOrderItemsTable;
