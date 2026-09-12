"use client";
import { useMemo, useState } from "react";
import styles from "./domain-overview.module.css";

type Column = { key: string; label: string; link?: boolean };
export function DomainDataTable({ title, rows, columns, empty }: { title: string; rows: Record<string,unknown>[]; columns: Column[]; empty: string }) {
  const [query,setQuery] = useState(""), [limit,setLimit] = useState(10), [sort,setSort] = useState({ key:"", ascending:false });
  const filtered = useMemo(() => rows.filter(item => Object.values(item).some(value => String(value ?? "").toLowerCase().includes(query.toLowerCase()))).sort((a,b) => {
    if (!sort.key) return 0;
    const left = a[sort.key], right = b[sort.key];
    if (left === null || left === undefined) return 1;
    if (right === null || right === undefined) return -1;
    const result = typeof left === "number" && typeof right === "number" ? left-right : String(left).localeCompare(String(right));
    return sort.ascending ? result : -result;
  }),[rows,query,sort]);
  function display(value: unknown, link: boolean | undefined) {
    if (value === null || value === undefined || value === "") return <span className={styles.muted}>Unavailable</span>;
    if (link && typeof value === "string" && /^https?:\/\//.test(value)) return <a href={value} target="_blank" rel="noopener noreferrer">{value.replace(/^https?:\/\//,"")}</a>;
    if (typeof value === "number") return value.toLocaleString("en-US",{maximumFractionDigits:2});
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  }
  if (!rows.length) return <p className={styles.noRows}>{empty}</p>;
  return <div className={styles.dataTable}><div className={styles.tableTools}><label><span className={styles.srOnly}>Filter {title}</span><input placeholder="Filter results…" value={query} onChange={event => {setQuery(event.target.value);setLimit(10);}} /></label><span>{filtered.length} of {rows.length} retrieved</span></div><div className={styles.tableScroll}><table aria-label={title}><thead><tr>{columns.map(column => <th key={column.key} aria-sort={sort.key !== column.key ? "none" : sort.ascending ? "ascending" : "descending"}><button onClick={() => setSort({ key:column.key,ascending:sort.key === column.key ? !sort.ascending : false })}>{column.label}{sort.key === column.key ? sort.ascending ? " ↑" : " ↓" : ""}</button></th>)}</tr></thead><tbody>{filtered.slice(0,limit).map((item,index) => <tr key={index}>{columns.map(column => <td key={column.key}>{display(item[column.key],column.link)}</td>)}</tr>)}</tbody></table></div>{!filtered.length && <p>No matching rows.</p>}{filtered.length > limit && <button className={styles.more} onClick={() => setLimit(limit+10)}>Show 10 more</button>}</div>;
}
