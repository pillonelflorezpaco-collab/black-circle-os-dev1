import { getEffectiveAgencyId } from "@/lib/agencyContext";
import { getSocialMediaAccounts } from "@/services/socialMedia.service";
import { PLATFORM_COLOR } from "@/services/post.service";
import { SocialMediaTabs } from "@/components/blackos/SocialMedia/SocialMediaTabs";

export default async function SocialMediaAccountsPage() {
  const agencyId = await getEffectiveAgencyId();
  const models = await getSocialMediaAccounts(agencyId);

  return (
    <>
      <div className="bc-topbar">
        <h2>
          <span className="accent">Social</span> Media
        </h2>
        <div className="bc-status">
          <span className="dot" />
          Dry-run execution only
        </div>
      </div>

      <SocialMediaTabs active="accounts" />

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Accounts</span>Model → Platform → Account
        </div>
      </div>

      {models.length === 0 ? (
        <div className="bc-card">
          <p className="bc-empty-state">No models with connected social accounts yet.</p>
        </div>
      ) : (
        models.map((model) => (
          <div key={model.id} className="bc-card" style={{ marginBottom: 16 }}>
            <div className="bc-watch-name" style={{ marginBottom: 10 }}>
              {model.name}
            </div>
            {model.accounts.map((account) => {
              const identifier = account.displayName || account.platformConnection?.externalAccountId || account.blotatoAccountRef || null;
              return (
                <div key={account.id} className="bc-watch-row">
                  <div className="bc-watch-left">
                    <div className="bc-watch-icon" style={{ background: "transparent" }}>
                      <span className="pc-dot" style={{ background: PLATFORM_COLOR[account.platform] ?? "#8C8A85", width: 9, height: 9, borderRadius: 3 }} />
                    </div>
                    <div>
                      <div className="bc-watch-name">
                        {account.platform} {identifier && <span style={{ color: "var(--bc-text-faint)", fontWeight: 400 }}>· @{identifier}</span>}
                      </div>
                      <div className="bc-watch-sub">
                        {account.source === "BLOTATO" ? `Blotato${account.blotatoAccountLabel ? ` — ${account.blotatoAccountLabel}` : ""}` : "Native"}
                        {account.platformConnection && ` · ${account.platformConnection.status}`}
                        {account.platformConnection?.lastError && <span style={{ color: "var(--bc-red)" }}> · {account.platformConnection.lastError}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="bc-watch-right">
                    <span className={`bc-status-pill ${account.isActive ? "ok" : "crit"}`}>{account.isActive ? "Active" : "Inactive"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </>
  );
}
