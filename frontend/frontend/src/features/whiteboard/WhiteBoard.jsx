// File: WhiteBoard.jsx
import React, { useRef, useCallback, useState, useEffect, useContext, useMemo } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import WhiteboardToolbar from "./WhiteBoardToolbar";
import { useWindowContext } from "../../context/WindowContext";
import { useHelpOverlay } from '../../context/HelpOverlayContext';
import { ThemeContext } from "../../context/ThemeContext";
import { getCssVariable } from "../../utils/theme";

// ✅ Import our parser
import { parseSketch } from "../../utils/sketch/SketchParser";

const Whiteboard = ({ label = "AI Whiteboard:", savedScene }) => {
  const excalidrawRef = useRef(null);
  const { saveWindowContentState } = useWindowContext();
  const lastSceneRef = useRef(savedScene ? JSON.stringify(savedScene) : null);
  const [scene, setScene] = useState(savedScene || null);
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [canvasBackground, setCanvasBackground] = useState(() =>
    getCssVariable("--bg-secondary", "var(--bg-secondary)")
  );

   const { isHelpVisible, toggleHelp, closeHelp } = useHelpOverlay();
    const helpId = 'whiteBoard';

  const initialData = useMemo(() => ({
    appState: {
      viewBackgroundColor: canvasBackground,
      gridMode: true,
      gridSize: 2,
    },
  }), [canvasBackground]);

  const handleChange = useCallback((elements, appState) => {
    const snapshot = { elements, appState };
    const serialized = JSON.stringify(snapshot);
    if (serialized !== lastSceneRef.current) {
      lastSceneRef.current = serialized;
      setScene(snapshot);
    }
  }, []);

  useEffect(() => {
    if (scene) {
      saveWindowContentState("whiteBoard", scene);
    }
  }, [scene, saveWindowContentState]);

  // ✅ NEW: compile sketch handler
  const handleCompileSketch = () => {
    if (!excalidrawRef.current) {
      console.warn("Excalidraw ref is not ready.");
      return;
    }

    const elements = excalidrawRef.current.getSceneElements();
    const appState = excalidrawRef.current.getAppState();
    const fullScene = { elements, appState };

    console.log("🧠 Extracted Excalidraw scene for parsing:", fullScene);

    // Later: pass this to SketchParser and open preview modal
    // const workflowSpec = SketchParser.parse(fullScene);
    // openPreview(workflowSpec);
    const spec = parseSketch(fullScene);
    console.log("📦 Parsed WorkflowSpec:", spec);

    // NEW: send to Workflow Lab if available
    if (typeof window.importWorkflowSpec === "function") {
      window.importWorkflowSpec(spec, { autoRun: false }); // leave off by default
      console.log("🚚 Sent WorkflowSpec to AiWorkflowLab.");
    } else {
      console.warn("⚠️ AiWorkflowLab importer not found. Is the AI Workflow window open?");
    }
  };

  useEffect(() => {
    const nextBackground = getCssVariable(
      "--bg-secondary",
      theme === "light" ? "var(--bg-secondary)" : "var(--bg-secondary)"
    );
    setCanvasBackground(nextBackground);
    if (excalidrawRef.current) {
      excalidrawRef.current.updateScene({
        appState: {
          viewBackgroundColor: nextBackground,
        },
      });
    }
  }, [theme]);

  return (
  <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
    <div className="help-inline-header">
      <h3 className="upload-title">{label}</h3>
      <div className="help-inline-spacer" />
      <button
        type="button"
        className="help-overlay-trigger"
        onClick={() => toggleHelp(helpId)}
      >
        ❓
      </button>
    </div>

      <WhiteboardToolbar
        excalidrawRef={excalidrawRef}
        onCompileSketch={handleCompileSketch}
        onThemeChange={toggleTheme}
        theme={theme}
    />

    <div style={{ flex: 1 }}>
      <Excalidraw
        ref={excalidrawRef}
        initialData={savedScene || initialData}
        onChange={handleChange}
        theme={theme === "light" ? "light" : "dark"}
      />
    </div>

    {/* ✅ Help Overlay */}
    {isHelpVisible(helpId) && (
      <div className="help-overlay visible">
        <div className="help-overlay-content">
          <span
            className="help-overlay-close"
            onClick={() => closeHelp(helpId)}
          >
            ×
          </span>
          <h3>Using the Whiteboard</h3>
          <ol>
            <li>Use the canvas to sketch ideas, chart layouts, or draft data workflows before building them.</li>
            <li>Create quick diagrams to visualize how datasets, cleaning steps, and charts connect.</li>
            <li>Save and load scenes to revisit previous concepts or collaborative sessions.</li>
            <li>Design and refine AI pipeline mockups that can later be imported directly into the AI Workflow module.</li>
          </ol>
          <p>
            Tip: The whiteboard is your sandbox — explore freely, experiment visually,
            and bring those ideas to life in your AI workflows.
          </p>
        </div>
      </div>
    )}
  </div>
);
}

export default Whiteboard;
