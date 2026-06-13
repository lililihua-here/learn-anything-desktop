import { useCallback, useEffect, useRef } from "react";
import * as d3 from "d3";
import type { TreeNode } from "../../lib/tauri";

interface MindMapProps {
  data: TreeNode;
  onNodeClick: (slug: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  mastered: "#22c55e",
  in_progress: "#eab308",
  needs_practice: "#ef4444",
  unexplored: "#9ca3af",
};

const NODE_RADIUS = 8;

export default function MindMap({ data, onNodeClick }: MindMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const render = useCallback(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Clear previous content
    svg.innerHTML = "";
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));

    const g = d3.select(svg).append("g");

    // Set up zoom
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
      });

    zoomRef.current = zoom;

    d3.select(svg)
      .call(zoom)
      // Do not reset zoom transform on double-click (let dblclick be a no-op on zoom)
      .on("dblclick.zoom", null);

    // Initial centered transform
    const initialTransform = d3.zoomIdentity.translate(width / 2, 60);
    d3.select(svg).call(zoom.transform, initialTransform);

    // Build hierarchy (capture as point node so TS knows positions exist)
    const hir = d3.hierarchy(data);
    const root = d3
      .tree<TreeNode>()
      .size([width - 200, height - 120])
      .nodeSize([180, 80])(hir);

    // Draw links
    const linkGen = d3
      .linkVertical<d3.HierarchyPointLink<TreeNode>, d3.HierarchyPointNode<TreeNode>>()
      .x((d) => d.x)
      .y((d) => d.y);

    g.append("g")
      .attr("fill", "none")
      .attr("stroke", "#6b7280")
      .attr("stroke-width", 1.5)
      .selectAll("path")
      .data(root.links())
      .join("path")
      .attr("d", (d) => linkGen(d));

    // Draw nodes
    const nodeGroup = g
      .append("g")
      .selectAll("g")
      .data(root.descendants())
      .join("g")
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .style("cursor", "pointer")
      .on("click", (_event, d) => {
        onNodeClick(d.data.slug);
      });

    // Circles
    nodeGroup
      .append("circle")
      .attr("r", NODE_RADIUS)
      .attr("fill", (d) => STATUS_COLORS[d.data.status] ?? STATUS_COLORS.unexplored)
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // Labels
    nodeGroup
      .append("text")
      .attr("dy", NODE_RADIUS + 14)
      .attr("text-anchor", "middle")
      .attr("font-size", (d) => (d.depth === 0 ? 13 : 11))
      .attr("font-weight", (d) => (d.depth === 0 ? "bold" : "normal"))
      .attr("fill", "#e5e7eb")
      .text((d) => d.data.name);
  }, [data, onNodeClick]);

  // Render on mount and when data/onNodeClick change
  useEffect(() => {
    render();
  }, [render]);

  // ResizeObserver for container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      render();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [render]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px] bg-gray-900 rounded-lg overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
