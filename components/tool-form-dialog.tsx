"use client";

import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { CATEGORIES, CONDITIONS, type Category, type Condition } from "@/convex/lib/domain";
import { errorMessage } from "@/lib/errors";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool?: Doc<"tools">;
  onCreated?: () => void;
};

export function ToolFormDialog({ open, onOpenChange, tool, onCreated }: Props) {
  const createTool = useMutation(api.tools.create);
  const updateTool = useMutation(api.tools.update);
  const [name, setName] = useState(tool?.name ?? "");
  const [category, setCategory] = useState<Category>(tool?.category ?? "power tools");
  const [condition, setCondition] = useState<Condition>(tool?.condition ?? "good");
  const [description, setDescription] = useState(tool?.description ?? "");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      const fields = { name, category, condition, description };
      if (tool) await updateTool({ toolId: tool._id, ...fields });
      else await createTool(fields);
      toast.success(tool ? "Listing updated" : "Tool listed");
      onOpenChange(false);
      if (!tool) {
        onCreated?.();
        setName("");
        setDescription("");
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tool ? "Edit listing" : "List a tool"}</DialogTitle>
          <DialogDescription>Neighbors see this when deciding what to borrow.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="tool-name">Name</Label>
            <Input id="tool-name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tool-category">Category</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as Category)}>
                <SelectTrigger id="tool-category" className="w-full capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((option) => (
                    <SelectItem key={option} value={option} className="capitalize">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tool-condition">Condition</Label>
              <Select value={condition} onValueChange={(value) => setCondition(value as Condition)}>
                <SelectTrigger id="tool-condition" className="w-full capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((option) => (
                    <SelectItem key={option} value={option} className="capitalize">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tool-description">Short description</Label>
            <Textarea id="tool-description" maxLength={500} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {tool ? "Save changes" : "List tool"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
