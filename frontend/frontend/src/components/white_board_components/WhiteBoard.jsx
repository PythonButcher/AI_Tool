// Whiteboard.jsx
import React, { useRef } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import WhiteboardToolbar from "./WhiteBoardToolbar";

const Whiteboard = () => {
  const excalidrawRef = useRef(null);
  // Set initial background color to light blue
  const initialData = {
    appState: {
      viewBackgroundColor: "#add8e6",
    },
  };

  return (
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
      <WhiteboardToolbar excalidrawRef={excalidrawRef} />
      <div style={{ flex: 1 }}>
        <Excalidraw ref={excalidrawRef} initialData={initialData} />
      </div>
    </div>
  );
};

export default Whiteboard;
