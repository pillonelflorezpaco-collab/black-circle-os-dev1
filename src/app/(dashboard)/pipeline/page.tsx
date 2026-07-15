import { listPipelineVideos } from "@/services/video.service";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { clientRepository } from "@/repositories/client.repository";
import { userRepository } from "@/repositories/user.repository";
import { getSelectedClientId } from "@/app/actions";

export default async function PipelinePage() {
  const selectedClientId = await getSelectedClientId();
  const [videos, session, clients, users] = await Promise.all([
    listPipelineVideos(selectedClientId),
    auth(),
    clientRepository.findMany(),
    userRepository.findMany(),
  ]);
  const canEdit = !!session?.user && can(session.user.role, "editerPipeline");
  const selectedClient = selectedClientId ? clients.find((c) => c.id === selectedClientId) : null;

  return (
    <>
      <div className="bc-topbar">
        <h2>
          Content Pipeline {selectedClient ? <span className="accent">— {selectedClient.name}</span> : null}
        </h2>
        <div className="bc-status">
          <span className="dot" />
          {videos.length} vidéos
        </div>
      </div>
      <KanbanBoard
        canEdit={canEdit}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        editors={users.map((u) => ({ id: u.id, name: u.name }))}
        defaultClientId={selectedClientId}
        initialVideos={videos.map((v) => ({
          id: v.id,
          title: v.title,
          stage: v.stage,
          clientId: v.clientId,
          clientName: v.client.name,
          assignedEditorId: v.assignedEditorId,
          driveUrl: v.driveUrl,
          caption: v.caption,
          editorInitials: v.assignedEditor
            ? v.assignedEditor.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .toUpperCase()
            : "—",
          lastEditedByName: v.lastEditedBy?.name ?? null,
        }))}
      />
    </>
  );
}
