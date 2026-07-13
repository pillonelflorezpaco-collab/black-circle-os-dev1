import { listPipelineVideos } from "@/services/video.service";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";

export default async function PipelinePage() {
  const videos = await listPipelineVideos();

  return (
    <>
      <div className="bc-topbar">
        <h2>Content Pipeline</h2>
        <div className="bc-status">
          <span className="dot" />
          {videos.length} vidéos
        </div>
      </div>
      <KanbanBoard
        initialVideos={videos.map((v) => ({
          id: v.id,
          title: v.title,
          stage: v.stage,
          clientName: v.client.name,
          editorInitials: v.assignedEditor
            ? v.assignedEditor.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .toUpperCase()
            : "—",
        }))}
      />
    </>
  );
}
