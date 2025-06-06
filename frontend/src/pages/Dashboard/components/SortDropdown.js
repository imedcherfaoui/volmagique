import React from "react";

export default function SortDropdown({ options, selected, onChange }) {
  return (
    <div className="relative inline-block text-left">
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
