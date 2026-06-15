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
  unexplored: "#94a3b8",
};

const NODE_RADIUS = 8;

export default function MindMap({ data, onNodeClick }: MindMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const render = useCallback(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const isDark = document.documentElement.classList.contains("dark");

    svg.innerHTML = "";
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));

    const g = d3.select(svg).append("g");
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
      });

    d3.select(svg)
      .call(zoom)
      .on("dblclick.zoom", null);

    const initialTransform = d3.zoomIdentity.translate(width / 2, 60);
    d3.select(svg).call(zoom.transform, initialTransform);

    const root = d3
      .tree<TreeNode>()
      .size([width - 200, height - 120])
      .nodeSize([180, 80])(d3.hierarchy(data));

    const linkGen = d3
      .linkVertical<d3.HierarchyPointLink<TreeNode>, d3.HierarchyPointNode<TreeNode>>()
      .x((node) => node.x)
      .y((node) => node.y);

    g.append("g")
      .attr("fill", "none")
      .attr("stroke", isDark ? "#475569" : "#cbd5e1")
      .attr("stroke-width", 1.5)
      .selectAll("path")
      .data(root.links())
      .join("path")
      .attr("d", (node) => linkGen(node));

    const nodeGroup = g
      .append("g")
      .selectAll("g")
      .data(root.descendants())
      .join("g")
      .attr("transform", (node) => `translate(${node.x},${node.y})`)
      .style("cursor", "pointer")
      .on("click", (_event, node) => {
        onNodeClick(node.data.slug);
      });

    nodeGroup
      .append("circle")
      .attr("r", NODE_RADIUS)
      .attr("fill", (node) => STATUS_COLORS[node.data.status] ?? STATUS_COLORS.unexplored)
      .attr("stroke", isDark ? "#0f172a" : "#ffffff")
      .attr("stroke-width", 2);

    nodeGroup
      .append("text")
      .attr("dy", NODE_RADIUS + 14)
      .attr("text-anchor", "middle")
      .attr("font-size", (node) => (node.depth === 0 ? 13 : 11))
      .attr("font-weight", (node) => (node.depth === 0 ? "bold" : "normal"))
      .attr("fill", isDark ? "#e2e8f0" : "#334155")
      .text((node) => node.data.name);
  }, [data, onNodeClick]);

  useEffect(() => {
    render();
  }, [render]);

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
    <div
      ref={containerRef}
      className="h-full min-h-[400px] w-full overflow-hidden rounded-lg bg-white dark:bg-slate-900"
    >
      <svg ref={svgRef} className="h-full w-full" />
    </div>
  );
}
