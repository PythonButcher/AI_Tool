// Whiteboard.jsx
import React, { useRef, useCallback } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import WhiteboardToolbar from "./WhiteBoardToolbar";
import { useWindowContext } from "../../context/WindowContext";

const Whiteboard = ({ savedScene }) => {
  const excalidrawRef = useRef(null);
  const { saveWindowContentState } = useWindowContext();
  const lastSceneRef = useRef(savedScene ? JSON.stringify(savedScene) : null);

  const initialData = {
    appState: {
      viewBackgroundColor: "#add8e6",
    },
  };

  const handleChange = useCallback(
    (elements, appState) => {
      const snapshot = JSON.stringify({ elements, appState });
      if (snapshot !== lastSceneRef.current) {
        lastSceneRef.current = snapshot;
        saveWindowContentState("whiteBoard", { elements, appState });
      }
    },
    [saveWindowContentState]
  );

  return (
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
      <WhiteboardToolbar excalidrawRef={excalidrawRef} />
      <div style={{ flex: 1 }}>
        <Excalidraw
          ref={excalidrawRef}
          initialData={savedScene || initialData}
          onChange={handleChange}
        />
      </div>
    </div>
  );
};

export default Whiteboard;
