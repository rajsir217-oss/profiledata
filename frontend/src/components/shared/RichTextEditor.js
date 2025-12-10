import React, { useRef, useEffect, useState, useCallback } from 'react';
import './RichTextEditor.css';

/**
 * Reusable Rich Text Editor Component (React 19 Compatible)
 * Uses native contentEditable + execCommand for WYSIWYG editing
 * 
 * @param {string} value - The HTML content
 * @param {function} onChange - Callback when content changes
 * @param {string} placeholder - Placeholder text
 * @param {number} minHeight - Minimum height in pixels (default: 200)
 * @param {boolean} readOnly - If true, editor is read-only
 * @param {string} className - Additional CSS classes
 * @param {boolean} simpleToolbar - If true, show simplified toolbar
 */
const RichTextEditor = ({
  value = '',
  onChange,
  placeholder = 'Start writing...',
  minHeight = 200,
  readOnly = false,
  className = '',
  simpleToolbar = false
}) => {
  const editorRef = useRef(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [activeFormats, setActiveFormats] = useState({});

  // Predefined colors for the color picker - diverse palette
  const colors = [
    // Row 1: Grayscale
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#ffffff',
    // Row 2: Primary colors
    '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#0000ff',
    // Row 3: Secondary colors  
    '#9900ff', '#ff00ff', '#ff6666', '#ffb366', '#ffff66', '#66ff66',
    // Row 4: Muted tones
    '#66ffff', '#6666ff', '#b366ff', '#ff66ff', '#cc0000', '#e69138',
    // Row 5: Dark tones
    '#bf9000', '#38761d', '#134f5c', '#0b5394', '#351c75', '#741b47',
    // Row 6: Light tones
    '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#9fc5e8'
  ];

  // Initialize editor with value
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  // Check active formats when selection changes
  const updateActiveFormats = useCallback(() => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
    });
  }, []);

  // Handle content changes
  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      // Check if content is empty (just <br> or empty)
      const isEmpty = html === '' || html === '<br>' || html === '<div><br></div>';
      onChange(isEmpty ? '' : html);
    }
    updateActiveFormats();
  };

  // Execute formatting command
  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
    updateActiveFormats();
  };

  // Apply text color
  const applyColor = (color) => {
    execCommand('foreColor', color);
    setShowColorPicker(false);
  };

  // Apply background color
  const applyBgColor = (color) => {
    execCommand('hiliteColor', color);
    setShowBgColorPicker(false);
  };

  // Clear formatting
  const clearFormatting = () => {
    execCommand('removeFormat');
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          execCommand('bold');
          break;
        case 'i':
          e.preventDefault();
          execCommand('italic');
          break;
        case 'u':
          e.preventDefault();
          execCommand('underline');
          break;
        default:
          break;
      }
    }
  };

  // Close color pickers when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.color-picker-container')) {
        setShowColorPicker(false);
        setShowBgColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Toolbar button component
  const ToolbarButton = ({ command, icon, title, isActive }) => (
    <button
      type="button"
      className={`toolbar-btn ${isActive ? 'active' : ''}`}
      onClick={() => execCommand(command)}
      title={title}
      tabIndex={-1}
    >
      {icon}
    </button>
  );

  // Color picker component - using inline styles to override any theme
  const ColorPicker = ({ colors, onSelect }) => (
    <div className="color-picker-dropdown" style={{ background: '#fff' }}>
      <div className="color-grid">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            className="color-swatch"
            style={{ 
              backgroundColor: color,
              background: color,
              WebkitAppearance: 'none',
              MozAppearance: 'none'
            }}
            onClick={() => onSelect(color)}
            title={color}
            aria-label={`Color ${color}`}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div 
      className={`rich-text-editor-container ${className} ${readOnly ? 'read-only' : ''}`}
      style={{ '--editor-min-height': `${minHeight}px` }}
    >
      {/* Toolbar */}
      {!readOnly && (
        <div className="rte-toolbar">
          {/* Text Formatting */}
          <div className="toolbar-group">
            <ToolbarButton 
              command="bold" 
              icon={<strong>B</strong>} 
              title="Bold (Ctrl+B)"
              isActive={activeFormats.bold}
            />
            <ToolbarButton 
              command="italic" 
              icon={<em>I</em>} 
              title="Italic (Ctrl+I)"
              isActive={activeFormats.italic}
            />
            <ToolbarButton 
              command="underline" 
              icon={<u>U</u>} 
              title="Underline (Ctrl+U)"
              isActive={activeFormats.underline}
            />
            {!simpleToolbar && (
              <ToolbarButton 
                command="strikeThrough" 
                icon={<s>S</s>} 
                title="Strikethrough"
                isActive={activeFormats.strikeThrough}
              />
            )}
          </div>

          {/* Colors */}
          <div className="toolbar-group">
            <div className="color-picker-container">
              <button
                type="button"
                className="toolbar-btn color-btn"
                onClick={() => {
                  setShowColorPicker(!showColorPicker);
                  setShowBgColorPicker(false);
                }}
                title="Text Color"
                tabIndex={-1}
              >
                <span className="color-icon">A</span>
                <span className="color-bar" style={{ backgroundColor: 'var(--primary-color)' }}></span>
              </button>
              {showColorPicker && (
                <ColorPicker 
                  colors={colors} 
                  onSelect={applyColor}
                  onClose={() => setShowColorPicker(false)}
                />
              )}
            </div>
            <div className="color-picker-container">
              <button
                type="button"
                className="toolbar-btn highlight-btn"
                onClick={() => {
                  setShowBgColorPicker(!showBgColorPicker);
                  setShowColorPicker(false);
                }}
                title="Highlight Color"
                tabIndex={-1}
              >
                <span className="highlight-icon">🖍️</span>
              </button>
              {showBgColorPicker && (
                <ColorPicker 
                  colors={colors} 
                  onSelect={applyBgColor}
                  onClose={() => setShowBgColorPicker(false)}
                />
              )}
            </div>
          </div>

          {/* Lists */}
          <div className="toolbar-group">
            <ToolbarButton 
              command="insertUnorderedList" 
              icon="•" 
              title="Bullet List"
              isActive={activeFormats.insertUnorderedList}
            />
            <ToolbarButton 
              command="insertOrderedList" 
              icon="1." 
              title="Numbered List"
              isActive={activeFormats.insertOrderedList}
            />
          </div>

          {/* Clear Formatting */}
          <div className="toolbar-group">
            <button
              type="button"
              className="toolbar-btn"
              onClick={clearFormatting}
              title="Clear Formatting"
              tabIndex={-1}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Editor Content Area */}
      <div
        ref={editorRef}
        className="rte-content"
        contentEditable={!readOnly}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onMouseUp={updateActiveFormats}
        onKeyUp={updateActiveFormats}
        data-placeholder={placeholder}
        suppressContentEditableWarning={true}
      />
    </div>
  );
};

export default RichTextEditor;
