import { useEffect, useRef } from 'react';


export default function OutsideClickWrapper({ onOutsideClick, children }) {
  const ref = useRef();

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onOutsideClick();
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onOutsideClick]);

  return <div ref={ref}>{children}</div>;
}