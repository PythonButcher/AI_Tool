// Whiteboard.jsx
import React, { useRef, useEffect, useCallback } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import WhiteboardToolbar from "./WhiteBoardToolbar";
import { useWindowContext } from "../../context/WindowContext";

const Whiteboard = ({ savedScene }) => {
  const excalidrawRef = useRef(null);
  const { saveWindowContentState } = useWindowContext();
  const initialData = {
    appState: {
      viewBackgroundColor: "#add8e6",
    },
  };

  const hasLoaded = useRef(false);

  useEffect(() => {
    if (!hasLoaded.current && savedScene && excalidrawRef.current) {
      excalidrawRef.current.updateScene(savedScene);
      hasLoaded.current = true;
    }
  }, [savedScene]);

  const handleChange = useCallback((elements, appState) => {
    saveWindowContentState('whiteBoard', { elements, appState });
  }, [saveWindowContentState]);

  return (
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
      <WhiteboardToolbar excalidrawRef={excalidrawRef} />
      <div style={{ flex: 1 }}>
        <Excalidraw ref={excalidrawRef} initialData={savedScene || initialData} onChange={handleChange} />
      </div>
    </div>
  );
};

export default Whiteboard;
