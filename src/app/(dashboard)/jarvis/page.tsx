import { JarvisWorkspace } from "@/components/blackos/CommandCenter/JarvisWorkspace";

export default function JarvisPage() {
  return (
    <>
      <div className="bc-topbar">
        <h2>
          <span className="accent">Jarvis</span>
        </h2>
        <div className="bc-status">
          <span className="dot" />
          Planning mode only — no execution
        </div>
      </div>

      <p style={{ color: "var(--bc-text-faint)", fontSize: 12.5, marginBottom: 18, maxWidth: 640 }}>
        The dedicated Jarvis workspace. Every request is resolved the same way as the Command Center panel — this page
        just keeps this session&apos;s plans visible below so you can compare requests without losing context.
      </p>

      <JarvisWorkspace />
    </>
  );
}
