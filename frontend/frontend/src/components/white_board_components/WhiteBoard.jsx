// Whiteboard.jsx
import React, { useRef, useEffect } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import WhiteboardToolbar from "./WhiteBoardToolbar";
import { useWindowContext } from "../../context/WindowContext";

const Whiteboard = () => {
  const excalidrawRef = useRef(null);
  const { saveComponentState, getComponentState } = useWindowContext();
  const savedScene = getComponentState('whiteBoard');
  // Set initial background color to light blue
  const initialData = savedScene || {
    appState: {
      viewBackgroundColor: "#add8e6",
    },
  };

  useEffect(() => {
    return () => {
      if (excalidrawRef.current) {
        const elements = excalidrawRef.current.getSceneElements();
        const appState = excalidrawRef.current.getAppState();
        saveComponentState('whiteBoard', { elements, appState });
      }
    };
  }, [saveComponentState]);

  return (
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
      <WhiteboardToolbar excalidrawRef={excalidrawRef} />
      <div style={{ flex: 1 }}>
        <Excalidraw
          ref={excalidrawRef}
          initialData={initialData}
          onChange={() => {
            if (excalidrawRef.current) {
              const elements = excalidrawRef.current.getSceneElements();
              const appState = excalidrawRef.current.getAppState();
              saveComponentState('whiteBoard', { elements, appState });
            }
          }}
        />
      </div>
    </div>
  );
};

export default Whiteboard;
