import React, { useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/crm";
import { LeadCard } from "./LeadCard";
import { cn } from "@/lib/utils";

interface KanbanBoardProps {
  leads: Lead[];
  onDragEnd: (leadId: string, newStatus: LeadStatus) => void;
  selectedLeads: Set<string>;
  onSelectLead: (id: string, checked: boolean) => void;
  setCallLead: (lead: Lead | null) => void;
  setPayLead: (lead: Lead | null) => void;
  setRemindLead: (lead: Lead | null) => void;
}

export function KanbanBoard({
  leads,
  onDragEnd,
  selectedLeads,
  onSelectLead,
  setCallLead,
  setPayLead,
  setRemindLead,
}: KanbanBoardProps) {
  // Group leads by status
  const columns = useMemo(() => {
    const groups: Record<LeadStatus, Lead[]> = {} as any;
    LEAD_STATUSES.forEach((s) => {
      groups[s.value] = [];
    });
    leads.forEach((l) => {
      if (groups[l.status]) {
        groups[l.status].push(l);
      }
    });
    return groups;
  }, [leads]);

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;

    if (source.droppableId !== destination.droppableId) {
      onDragEnd(draggableId, destination.droppableId as LeadStatus);
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex h-full gap-4 overflow-x-auto pb-4 pt-2">
        {LEAD_STATUSES.map((column) => (
          <div key={column.value} className="flex min-w-[320px] flex-col rounded-xl bg-secondary/30 p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider", column.tone)}>
                {column.label}
              </h3>
              <span className="text-xs font-medium text-muted-foreground">
                {columns[column.value].length}
              </span>
            </div>
            
            <Droppable droppableId={column.value}>
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={cn(
                    "flex-1 space-y-3 rounded-lg p-1 transition-colors min-h-[150px]",
                    snapshot.isDraggingOver ? "bg-secondary/50" : ""
                  )}
                >
                  {columns[column.value].map((lead, index) => (
                    <Draggable key={lead.id} draggableId={lead.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={{
                            ...provided.draggableProps.style,
                            opacity: snapshot.isDragging ? 0.8 : 1,
                          }}
                        >
                          <LeadCard
                            lead={lead}
                            onCall={setCallLead}
                            onPay={setPayLead}
                            onRemind={setRemindLead}
                            selected={selectedLeads.has(lead.id)}
                            onSelect={onSelectLead}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
