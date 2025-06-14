import { useEffect, useState } from 'react';

export const useContextMenu = () => {
  const [clicked, setClicked] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleContextMenu = (event) => {
      event.preventDefault();
      setCoords({ x: event.clientX, y: event.clientY }); // ✅ use clientX/clientY for viewport accuracy
      setClicked(true);
    };

    const handleClick = () => setClicked(false);

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  return { clicked, setClicked, coords, setCoords };
};
