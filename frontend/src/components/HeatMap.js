import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import './HeatMap.css';

const HeatMap = ({ 
  data, 
  title, 
  xLabel, 
  yLabel, 
  colorScheme = 'Blues',
  onCellClick,
  width = 800,
  height = 400,
  margin = { top: 60, right: 60, bottom: 100, left: 100 }
}) => {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, data: null });
  const [error, setError] = useState(null);

  console.log('HeatMap component received:', { data, title, dataLength: data?.length });

  useEffect(() => {
    if (!data || data.length === 0) return;

    try {
      // Clear previous content
      d3.select(svgRef.current).selectAll('*').remove();

    // Set up dimensions
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Create main group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Calculate grid dimensions - use a more reasonable layout
    const minCellSize = 80;  // Minimum cell size in pixels
    const maxCols = Math.floor(innerWidth / minCellSize);
    const cols = Math.min(data.length, maxCols || 1);
    const rows = Math.ceil(data.length / cols);
    const cellWidth = innerWidth / cols;
    const cellHeight = innerHeight / rows;
    
    console.log('Grid dimensions:', { 
      dataLength: data.length, 
      innerWidth, 
      innerHeight, 
      minCellSize,
      maxCols,
      cols, 
      rows, 
      cellWidth, 
      cellHeight 
    });

    // Create color scale
    const maxValue = Math.max(...data.map(d => d.value || d.count || 0));
    console.log('Max value:', maxValue, 'Color scheme:', colorScheme);
    
    let interpolator;
    try {
      interpolator = d3[`interpolate${colorScheme}`];
      if (!interpolator) {
        console.warn(`Color scheme ${colorScheme} not found, using Blues`);
        interpolator = d3.interpolateBlues;
      }
    } catch (e) {
      console.warn('Error with color scheme, using Blues:', e);
      interpolator = d3.interpolateBlues;
    }
    
    const colorScale = d3.scaleSequential()
      .domain([0, maxValue])
      .interpolator(interpolator);

    // Create cells
    const cells = g.selectAll('.cell')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'cell')
      .attr('transform', (d, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * cellWidth;
        const y = row * cellHeight;
        console.log(`Cell ${i} (${d.name}): col=${col}, row=${row}, x=${x}, y=${y}`);
        return `translate(${x},${y})`;
      });

    // Add rectangles
    const rects = cells.append('rect')
      .attr('width', cellWidth - 2)
      .attr('height', cellHeight - 2)
      .attr('rx', 4)
      .attr('fill', d => {
        const color = colorScale(d.value || d.count || 0);
        console.log('Color for', d.name, d.value || d.count, ':', color);
        return color;
      })
      .attr('class', 'heat-map-rect')
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        console.log('Mouse over:', d);
        d3.select(this)
          .transition()
          .duration(200)
          .attr('stroke', '#333')
          .attr('stroke-width', 2);

        setTooltip({
          show: true,
          x: event.pageX + 10,
          y: event.pageY - 10,
          data: d
        });
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('stroke', 'none');

        setTooltip({ show: false, x: 0, y: 0, data: null });
      })
      .on('click', function(event, d) {
        if (onCellClick) {
          onCellClick(d);
        }
      });

    // Add labels
    cells.append('text')
      .attr('x', cellWidth / 2)
      .attr('y', cellHeight / 2 - 10)
      .attr('text-anchor', 'middle')
      .attr('class', 'heat-map-label')
      .text(d => {
        const name = d.name || d.location || d.profession || d.age || '';
        return name.length > 12 ? name.substring(0, 12) + '...' : name;
      });

    // Add values
    cells.append('text')
      .attr('x', cellWidth / 2)
      .attr('y', cellHeight / 2 + 8)
      .attr('text-anchor', 'middle')
      .attr('class', 'heat-map-value')
      .text(d => d.value || d.count || 0);

    // Add color legend
    const legendWidth = 20;
    const legendHeight = innerHeight;
    const legendX = innerWidth + 20;
    
    const legend = g.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${legendX}, 0)`);

    const legendScale = d3.scaleLinear()
      .domain([0, maxValue])
      .range([legendHeight, 0]);

    const legendAxis = d3.axisRight(legendScale)
      .ticks(5)
      .tickFormat(d3.format('d'));

    // Add legend gradient
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'legend-gradient')
      .attr('x1', '0%')
      .attr('y1', '100%')
      .attr('x2', '0%')
      .attr('y2', '0%');

    gradient.selectAll('stop')
      .data(d3.range(0, 1.01, 0.01))
      .enter()
      .append('stop')
      .attr('offset', d => `${d * 100}%`)
      .attr('stop-color', d => colorScale(d * maxValue));

    legend.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', 'url(#legend-gradient)')
      .style('border', '1px solid #ccc');

    legend.append('g')
      .attr('transform', `translate(${legendWidth}, 0)`)
      .call(legendAxis);

    // Add legend title
    legend.append('text')
      .attr('x', legendWidth / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('class', 'legend-title')
      .text('Count');

    // Add title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('class', 'heat-map-title')
      .text(title);

    // Add a test rectangle to verify SVG is working
    svg.append('rect')
      .attr('x', 50)
      .attr('y', 50)
      .attr('width', 100)
      .attr('height', 100)
      .attr('fill', 'red')
      .attr('opacity', 0.3);

    console.log('SVG elements created, total cells:', data.length);

    } catch (error) {
      console.error('Error rendering heat map:', error);
      setError(error.message || 'Unknown error occurred');
    }
  }, [data, width, height, margin, colorScheme, onCellClick, title]);

  if (error) {
    return (
      <div className="heat-map-container">
        <div className="error-message">
          <span>❌</span> Error rendering heat map: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="heat-map-container">
      <svg ref={svgRef}></svg>
      {tooltip.show && (
        <div 
          className="heat-map-tooltip"
          style={{ 
            left: tooltip.x, 
            top: tooltip.y,
            position: 'absolute',
            pointerEvents: 'none'
          }}
        >
          <div className="tooltip-header">
            {tooltip.data?.name || tooltip.data?.location || tooltip.data?.profession || tooltip.data?.age}
          </div>
          <div className="tooltip-content">
            <div>Total: <strong>{tooltip.data?.value || tooltip.data?.count || 0}</strong></div>
            {tooltip.data?.maleCount !== undefined && (
              <div>Male: <strong>{tooltip.data.maleCount}</strong></div>
            )}
            {tooltip.data?.femaleCount !== undefined && (
              <div>Female: <strong>{tooltip.data.femaleCount}</strong></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HeatMap;
