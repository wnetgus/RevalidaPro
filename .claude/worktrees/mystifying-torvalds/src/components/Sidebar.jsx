import React from "react";
import {
  FaHome,
  FaUserMd,
  FaSyringe,
  FaChild,
  FaClipboardList,
  FaStethoscope
} from "react-icons/fa";

const Sidebar = ({ onSelectPage, collapsed, setCollapsed }) => {
  return (
    <div className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <button
        className="toggle-btn"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? "»" : "«"}
      </button>

      <ul>
        <li onClick={() => onSelectPage("Dashboard")}>
          <FaHome />
          {!collapsed && <span>Dashboard</span>}
        </li>

        <li>
          <FaUserMd />
          {!collapsed && <span>GO</span>}
        </li>

        <li>
          <FaSyringe />
          {!collapsed && <span>Cirurgia</span>}
        </li>

        <li>
          <FaChild />
          {!collapsed && <span>Pediatria</span>}
        </li>

        <li>
          <FaClipboardList />
          {!collapsed && <span>Preventiva</span>}
        </li>

        <li>
          <FaStethoscope />
          {!collapsed && <span>Clínica</span>}
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;