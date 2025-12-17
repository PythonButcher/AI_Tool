// WhiteboardToolbar.jsx
import React, { useMemo, useState } from "react";
import {
  FaMousePointer,
  FaPenFancy,
  FaMinus,
  FaRegSquare,
  FaRegCircle,
  FaFont,
  FaHighlighter,
  FaEraser,
  FaLongArrowAltRight,
  FaSwatchbook,
} from "react-icons/fa";
import { BsDiamond } from "react-icons/bs";
import { MdLineWeight } from "react-icons/md";
import "./WhiteBoardToolbar.css";

const WhiteboardToolbar = ({ excalidrawRef, onCompileSketch, onThemeChange, theme }) => {
  const [strokeColor, setStrokeColor] = useState("#0f172a");
  const [fillColor, setFillColor] = useState("#e0e7ff");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [activeTool, setActiveTool] = useState("selection");

  const tools = useMemo(
    () => [
      { type: "selection", label: "Select", icon: <FaMousePointer /> },
      { type: "freedraw", label: "Pencil", icon: <FaPenFancy /> },
      { type: "line", label: "Line", icon: <FaMinus /> },
      { type: "rectangle", label: "Rectangle", icon: <FaRegSquare /> },
      { type: "diamond", label: "Diamond", icon: <BsDiamond /> },
      { type: "ellipse", label: "Ellipse", icon: <FaRegCircle /> },
      { type: "arrow", label: "Arrow", icon: <FaLongArrowAltRight /> },
      { type: "text", label: "Text", icon: <FaFont /> },
      { type: "highlighter", label: "Highlighter", icon: <FaHighlighter /> },
      { type: "eraser", label: "Eraser", icon: <FaEraser /> },
    ],
    []
  );

  const updateStyleState = (nextAppState) => {
    if (!excalidrawRef.current) return;
    excalidrawRef.current.updateScene({
      appState: {
        currentItemStrokeColor: strokeColor,
        currentItemBackgroundColor: fillColor,
        currentItemStrokeWidth: strokeWidth,
        ...nextAppState,
      },
    });
  };

  const handleToolSelect = (toolType) => {
    if (!excalidrawRef.current) return;

    const isHighlighter = toolType === "highlighter";
    const targetType = isHighlighter ? "freedraw" : toolType;

    const nextAppState = {
      activeTool: { type: targetType },
    };

    if (isHighlighter) {
      nextAppState.currentItemStrokeColor = "rgba(250, 204, 21, 0.9)";
      nextAppState.currentItemBackgroundColor = "rgba(250, 204, 21, 0.2)";
      nextAppState.currentItemOpacity = 60;
    } else {
      nextAppState.currentItemOpacity = 100;
    }

    updateStyleState(nextAppState);
    setActiveTool(toolType);
  };

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

  const handleStrokeChange = (event) => {
    const value = event.target.value;
    setStrokeColor(value);
    updateStyleState({ currentItemStrokeColor: value });
  };

  const handleFillChange = (event) => {
    const value = event.target.value;
    setFillColor(value);
    updateStyleState({ currentItemBackgroundColor: value });
  };

  const handleStrokeWidthChange = (event) => {
    const value = Number(event.target.value);
    setStrokeWidth(value);
    updateStyleState({ currentItemStrokeWidth: value });
  };

  return (
    <div className={`whiteboard-toolbar ${theme === "dark" ? "dark" : "light"}`} role="toolbar" aria-label="Whiteboard toolbar">
      <div className="toolbar-section tool-buttons" aria-label="Drawing tools">
        {tools.map((tool) => (
          <button
            key={tool.type}
            type="button"
            className={`tool-button ${activeTool === tool.type ? "active" : ""}`}
            onClick={() => handleToolSelect(tool.type)}
            aria-label={tool.label}
          >
            {tool.icon}
            <span className="tool-label">{tool.label}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-section style-controls" aria-label="Style controls">
        <div className="control">
          <label htmlFor="stroke-color" className="control-label">
            <FaSwatchbook aria-hidden="true" /> Stroke
          </label>
          <input
            id="stroke-color"
            type="color"
            value={strokeColor}
            onChange={handleStrokeChange}
            aria-label="Stroke color"
          />
        </div>
        <div className="control">
          <label htmlFor="fill-color" className="control-label">
            <FaSwatchbook aria-hidden="true" /> Fill
          </label>
          <input
            id="fill-color"
            type="color"
            value={fillColor}
            onChange={handleFillChange}
            aria-label="Fill color"
          />
        </div>
        <div className="control">
          <label htmlFor="stroke-width" className="control-label">
            <MdLineWeight aria-hidden="true" /> Width
          </label>
          <select id="stroke-width" value={strokeWidth} onChange={handleStrokeWidthChange} aria-label="Stroke width">
            {[1, 2, 4, 6, 8, 10, 12].map((width) => (
              <option key={width} value={width}>
                {width}px
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="toolbar-section toolbar-actions" aria-label="Whiteboard actions">
        <button type="button" className="action-button" onClick={handleClear}>
          🧹 Clear Canvas
        </button>
        <button type="button" className="action-button" onClick={handleSaveScene}>
          💾 Save Scene
        </button>
        <button type="button" className="action-button" onClick={handleLoadScene}>
          📂 Load Scene
        </button>
        <button
          type="button"
          className="action-button"
          onClick={() => {
            if (onCompileSketch) onCompileSketch();
          }}
        >
          ⚙️ Compile Sketch → Pipeline
        </button>
        <button type="button" className="action-button" onClick={onThemeChange} aria-label="Toggle theme">
          {theme === "light" ? "🌙" : "☀️"}
        </button>
      </div>
    </div>
  );
};

export default WhiteboardToolbar;
