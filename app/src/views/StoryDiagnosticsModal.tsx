import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  X,
} from "lucide-react";
import { useGraphStore } from "../store";
import { analyzeStoryHealth, type DiagnosticSeverity } from "../data/diagnostics/storyDiagnostics";
import "./diagnostics.css";

interface Props {
  onClose: () => void;
  onNavigateToNode?: (nodeId: string, nodeType: string) => void;
}

export default function StoryDiagnosticsModal({ onClose, onNavigateToNode }: Props) {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const select = useGraphStore((s) => s.select);

  const [filter, setFilter] = useState<"all" | DiagnosticSeverity>("all");

  const report = useMemo(() => {
    return analyzeStoryHealth(nodes, edges);
  }, [nodes, edges]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const { errorCount, warnCount, infoCount } = useMemo(() => {
    let errorCount = 0;
    let warnCount = 0;
    let infoCount = 0;
    for (const issue of report.issues) {
      if (issue.severity === "error") errorCount++;
      else if (issue.severity === "warning") warnCount++;
      else if (issue.severity === "info") infoCount++;
    }
    return { errorCount, warnCount, infoCount };
  }, [report.issues]);

  const filteredIssues = useMemo(() => {
    if (filter === "all") return report.issues;
    return report.issues.filter((i) => i.severity === filter);
  }, [report.issues, filter]);

  const handleSelectNode = (nodeId: string) => {
    select([nodeId]);
    const node = nodes[nodeId];
    if (onNavigateToNode && node) {
      onNavigateToNode(nodeId, node.type);
    }
    onClose();
  };

  return (
    <div className="tln-dialog-scrim" onClick={onClose}>
      <div
        className="tln-dialog tln-diag-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Story Architecture & Health Diagnostics"
      >
        <header className="tln-diag-head">
          <div className="tln-diag-title-row">
            <Activity size={18} className="tln-diag-issue-icon--info" />
            <h2 className="tln-diag-title">Story Architecture & Health</h2>
            <span className="tln-diag-tag">Effect Engine</span>
          </div>
          <button className="tln-btn tln-btn--quiet" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </header>

        <div className="tln-diag-body">
          {/* Summary / Score banner */}
          <div className="tln-diag-summary">
            <div className="tln-diag-score-box">
              <span className="tln-diag-score-num">{report.score}</span>
              <span className="tln-diag-score-max">/ 100</span>
              <span className="tln-diag-score-label">Health Score</span>
            </div>

            <div className="tln-diag-stats">
              <div className="tln-diag-rating">{report.rating}</div>
              <div className="tln-diag-metrics-grid">
                <div className="tln-diag-metric-item">
                  <span className="tln-diag-metric-val">
                    {report.metrics.connectedScenes} / {report.metrics.totalScenes}
                  </span>
                  <span className="tln-diag-metric-lbl">Connected Scenes</span>
                </div>
                <div className="tln-diag-metric-item">
                  <span className="tln-diag-metric-val">
                    {report.metrics.activeCharacters} / {report.metrics.totalCharacters}
                  </span>
                  <span className="tln-diag-metric-lbl">Active Characters</span>
                </div>
                {report.metrics.totalBeats > 0 && (
                  <div className="tln-diag-metric-item">
                    <span className="tln-diag-metric-val">
                      {report.metrics.fulfilledBeats} / {report.metrics.totalBeats}
                    </span>
                    <span className="tln-diag-metric-lbl">Beats Fulfilled</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="tln-diag-filter-row">
            <button
              className={`tln-diag-filter-btn${filter === "all" ? " tln-diag-filter-btn--active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All Issues <span className="tln-diag-badge">{report.issues.length}</span>
            </button>
            <button
              className={`tln-diag-filter-btn${filter === "error" ? " tln-diag-filter-btn--active" : ""}`}
              onClick={() => setFilter("error")}
            >
              Errors <span className="tln-diag-badge">{errorCount}</span>
            </button>
            <button
              className={`tln-diag-filter-btn${filter === "warning" ? " tln-diag-filter-btn--active" : ""}`}
              onClick={() => setFilter("warning")}
            >
              Warnings <span className="tln-diag-badge">{warnCount}</span>
            </button>
            <button
              className={`tln-diag-filter-btn${filter === "info" ? " tln-diag-filter-btn--active" : ""}`}
              onClick={() => setFilter("info")}
            >
              Suggestions <span className="tln-diag-badge">{infoCount}</span>
            </button>
          </div>

          {/* Issue list */}
          <div className="tln-diag-issues-list">
            {filteredIssues.length === 0 ? (
              <div className="tln-diag-empty">
                <CheckCircle2 size={36} color="var(--ok)" style={{ marginBottom: 8 }} />
                <p>No {filter === "all" ? "" : filter} issues detected.</p>
                <small>
                  Your story graph is structurally coherent and narrative flow is continuous.
                </small>
              </div>
            ) : (
              filteredIssues.map((issue) => (
                <div
                  key={issue.id}
                  className={`tln-diag-issue-card tln-diag-issue-card--${issue.severity}`}
                >
                  <div className={`tln-diag-issue-icon tln-diag-issue-icon--${issue.severity}`}>
                    {issue.severity === "error" ? (
                      <AlertCircle size={18} />
                    ) : issue.severity === "warning" ? (
                      <AlertTriangle size={18} />
                    ) : (
                      <Info size={18} />
                    )}
                  </div>

                  <div className="tln-diag-issue-content">
                    <div className="tln-diag-issue-head">
                      <h4 className="tln-diag-issue-title">{issue.title}</h4>
                      <span className="tln-diag-issue-cat">{issue.category}</span>
                    </div>

                    <p className="tln-diag-issue-msg">{issue.message}</p>

                    {issue.nodeIds.length > 0 && (
                      <div className="tln-diag-nodes-row">
                        {issue.nodeIds.map((nodeId) => {
                          const node = nodes[nodeId];
                          const title = node?.title || nodeId;
                          return (
                            <button
                              key={nodeId}
                              className="tln-diag-node-jump"
                              onClick={() => handleSelectNode(nodeId)}
                              title={`Jump to ${title}`}
                            >
                              <span>{title}</span>
                              <ChevronRight size={12} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
