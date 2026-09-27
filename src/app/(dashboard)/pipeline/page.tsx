import { listPipelineVideos } from "@/services/video.service";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { modelRepository } from "@/repositories/model.repository";
import { userRepository } from "@/repositories/user.repository";
import { getSelectedModelId } from "@/app/actions";
import { getEffectiveAgencyId } from "@/lib/agencyContext";

export default async function PipelinePage() {
  const [selectedModelId, agencyId] = await Promise.all([getSelectedModelId(), getEffectiveAgencyId()]);
  const [videos, session, models, users] = await Promise.all([
    listPipelineVideos(agencyId, selectedModelId),
    auth(),
    modelRepository.findMany(agencyId),
    userRepository.findMany(agencyId),
  ]);
  const canEdit = !!session?.user && can(session.user.role, "editerPipeline");
  const selectedModel = selectedModelId ? models.find((m) => m.id === selectedModelId) : null;

  return (
    <>
      <div className="bc-topbar">
        <h2>
          Content Pipeline {selectedModel ? <span className="accent">— {selectedModel.name}</span> : null}
        </h2>
        <div className="bc-status">
          <span className="dot" />
          {videos.length} vidéos
        </div>
      </div>
      <KanbanBoard
        canEdit={canEdit}
        models={models.map((m) => ({ id: m.id, name: m.name }))}
        editors={users.map((u) => ({ id: u.id, name: u.name }))}
        defaultModelId={selectedModelId}
        initialVideos={videos.map((v) => ({
          id: v.id,
          title: v.title,
          stage: v.stage,
          modelId: v.modelId,
          modelName: v.model.name,
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
