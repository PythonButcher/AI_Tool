// ContextMenu.jsx

import React from 'react';
import { Container, MenuHeader, Divider, MenuOption } from './ContextMenu.styles';
import { FaRegFileAlt } from 'react-icons/fa'; // Default fallback icon

// A generic context menu that appears on right-click
export default function ContextMenu({ x, y, options, onSelect, headerText }) {
  if (!options?.length) return null; // Do not render if no options provided

  return (
    <Container x={x} y={y}>
      {/* Optional menu header */}
      {headerText && (
        <>
          <MenuHeader>{headerText}</MenuHeader>
          <Divider />
        </>
      )}

      {/* Render each menu item */}
      {options.map((option) => {
        const Icon = option.icon || FaRegFileAlt; // Use default icon if none specified
        return (
          <MenuOption key={option.id} onClick={() => onSelect(option.id)}>
            <Icon className="menu-icon" />
            <span className="option-label">{option.label}</span>
          </MenuOption>
        );
      })}
    </Container>
  );
}
