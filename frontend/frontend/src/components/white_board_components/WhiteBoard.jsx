import React, { useRef, useCallback, useState, useEffect } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import "../css/white_board_css/WhiteBoardModern.css";
import { useWindowContext } from "../../context/WindowContext";
import { parseSketch } from "../../utils/sketch/SketchParser";

const WhiteBoard = ({ savedScene }) => {
  const excalidrawRef = useRef(null);
  const { saveWindowContentState } = useWindowContext();
  const lastSceneRef = useRef(savedScene ? JSON.stringify(savedScene) : null);
  const [scene, setScene] = useState(savedScene || null);

  const getPreferredTheme = () =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  const [theme, setTheme] = useState(getPreferredTheme());

  const initialData = savedScene
    ? {
        ...savedScene,
        appState: {
          ...(savedScene.appState || {}),
          viewBackgroundColor: "transparent",
          theme,
        },
      }
    : {
        appState: {
          viewBackgroundColor: "transparent",
          theme,
        },
      };

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

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleThemeChange = () => {
      const nextTheme = mediaQuery.matches ? "dark" : "light";
      setTheme(nextTheme);
      if (excalidrawRef.current) {
        const appState = {
          ...excalidrawRef.current.getAppState(),
          theme: nextTheme,
          viewBackgroundColor: "transparent",
        };
        excalidrawRef.current.updateScene({ appState });
      }
    };
    mediaQuery.addEventListener("change", handleThemeChange);
    return () => mediaQuery.removeEventListener("change", handleThemeChange);
  }, []);

  const handleClear = () => {
    if (excalidrawRef.current) {
      const appState = {
        ...excalidrawRef.current.getAppState(),
        viewBackgroundColor: "transparent",
      };
      excalidrawRef.current.updateScene({ elements: [], appState });
    }
  };

  const handleSaveScene = () => {
    if (!excalidrawRef.current) return;

    const scene = {
      type: "excalidraw",
      version: 2,
      source: "ai-data-tool",
      elements: excalidrawRef.current.getSceneElements(),
      appState: excalidrawRef.current.getAppState(),
    };

    const blob = new Blob([JSON.stringify(scene, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "whiteboard-scene.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadScene = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const json = JSON.parse(text);

        if (excalidrawRef.current) {
          const currentTheme = excalidrawRef.current.getAppState().theme;
          const appState = {
            ...(json.appState || {}),
            viewBackgroundColor: "transparent",
            theme: currentTheme,
          };
          excalidrawRef.current.updateScene({
            elements: json.elements || [],
            appState,
          });
        }
      } catch (err) {
        alert("Failed to load scene: " + err.message);
      }
    };

    input.click();
  };

  const handleCompileSketch = () => {
    if (!excalidrawRef.current) {
      console.warn("Excalidraw ref is not ready.");
      return;
    }

    const elements = excalidrawRef.current.getSceneElements();
    const appState = excalidrawRef.current.getAppState();
    const fullScene = { elements, appState };

    console.log("🧠 Extracted Excalidraw scene for parsing:", fullScene);
    const spec = parseSketch(fullScene);
    console.log("📦 Parsed WorkflowSpec:", spec);

    if (typeof window.importWorkflowSpec === "function") {
      window.importWorkflowSpec(spec, { autoRun: false });
      console.log("🚚 Sent WorkflowSpec to AiWorkflowLab.");
    } else {
      console.warn("⚠️ AiWorkflowLab importer not found. Is the AI Workflow window open?");
    }
  };

  return (
    <div className="whiteboard-modern">
      <div className="wb-toolbar">
        <button onClick={handleClear}>🧹 Clear Canvas</button>
        <button onClick={handleSaveScene}>💾 Save Scene</button>
        <button onClick={handleLoadScene}>📂 Load Scene</button>
        <button onClick={handleCompileSketch}>⚙️ Compile Sketch → Pipeline</button>
      </div>
      <div className="wb-canvas">
        <Excalidraw
          ref={excalidrawRef}
          initialData={initialData}
          onChange={handleChange}
        />
      </div>
    </div>
  );
};

export default WhiteBoard;
