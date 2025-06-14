// WhiteboardToolbar.jsx
import React from "react";

const WhiteboardToolbar = ({ excalidrawRef }) => {
  const handleClear = () => {
    if (excalidrawRef.current) {
      excalidrawRef.current.updateScene({ elements: [] });
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
        excalidrawRef.current.updateScene({
          elements: json.elements || [],
          appState: json.appState || {},
        });
      }
    } catch (err) {
      alert("Failed to load scene: " + err.message);
    }
  };

  input.click();
};


  return (
    <div
      className="whiteboard-toolbar"
      style={{
        display: "flex",
        gap: "8px",
        padding: "8px 12px",
        backgroundColor: "#1e1e1e",
        borderRadius: "6px",
        marginBottom: "8px",
        alignItems: "center",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }}
    >
      <button
        onClick={handleClear}
        style={{
          backgroundColor: "#2c2c2c",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          padding: "6px 12px",
          cursor: "pointer",
          fontSize: "14px",
          transition: "background 0.2s ease",
        }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#3a3a3a")}
        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#2c2c2c")}
      >
        🧹 Clear Canvas
      </button>

      <button
        onClick={handleSaveScene}
        style={{
            backgroundColor: "#2c2c2c",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: "14px",
        }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#3a3a3a")}
        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#2c2c2c")}
        >
        💾 Save Scene
        </button>

        <button
        onClick={handleLoadScene}
        style={{
            backgroundColor: "#2c2c2c",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: "14px",
        }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#3a3a3a")}
        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#2c2c2c")}
        >
        📂 Load Scene
        </button>



      {/* Add future buttons here with same style */}
    </div>
  );
};

export default WhiteboardToolbar;
