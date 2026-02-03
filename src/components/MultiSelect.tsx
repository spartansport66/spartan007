"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList, // Import CommandList
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface MultiSelectProps {
  options: { value: string; label: string }[];
  value: string[]; // Renamed from 'selected'
  onChange: (value: string[]) => void; // Renamed from 'onSelect'
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxHeightClass?: string; // New prop for max height class
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  value, // Using 'value'
  onChange, // Using 'onChange'
  placeholder = "Select items...",
  className,
  disabled = false,
  maxHeightClass = "max-h-[300px]", // Default max height
}) => {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (currentValue: string) => {
    const newSelected = value.includes(currentValue)
      ? value.filter((item) => item !== currentValue)
      : [...value, currentValue];
    onChange(newSelected); // Call onChange
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {/* Ensure only one root element is passed inside the Button */}
          <span className="flex items-center justify-between w-full">
            <div className="flex flex-wrap gap-1">
              {value.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                value.map((itemValue) => { // Use itemValue to avoid conflict with prop 'value'
                  const option = options.find((opt) => opt.value === itemValue);
                  return (
                    <Badge key={itemValue} variant="secondary" className="flex items-center gap-1">
                      {option?.label}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(itemValue);
                        }}
                        className="ml-1 text-muted-foreground hover:text-foreground"
                        disabled={disabled}
                      >
                        &times;
                      </button>
                    </Badge>
                  );
                })
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Search items..." />
          <CommandEmpty>No item found.</CommandEmpty>
          <CommandGroup>
            <CommandList className={cn("overflow-y-auto", maxHeightClass)}>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => handleSelect(option.value)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value.includes(option.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandList>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default MultiSelect;