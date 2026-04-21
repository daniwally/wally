"use client";

import { useState } from "react";
import { Icon } from "../Icon";
import { addCustomMerchantType, deleteCustomMerchantType } from "@/app/actions";

type CustomType = {
  slug: string;
  label: string;
  icon: string | null;
  description: string | null;
  is_essential: boolean | null;
};

export function CustomTypesManager({ customTypes }: { customTypes: CustomType[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="v2-card" style={{ marginTop: 16, padding: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          padding: "16px 20px",
          background: "transparent",
          border: "none",
          borderBottom: open ? "1px solid var(--border)" : "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "var(--sans)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div>
          <div className="v2-card-title">➕ Categorías personalizadas</div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
            {customTypes.length} custom · agregá tipos de gasto propios (ej &ldquo;libros&rdquo;,
            &ldquo;juguetes&rdquo;). El extractor las toma en cuenta en cada scan.
          </div>
        </div>
        <span
          style={{
            fontSize: 14,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
            color: "var(--text-3)",
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <>
          {/* Form nuevo */}
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid var(--border)",
              background: "var(--surface-2)",
            }}
          >
            <form
              action={addCustomMerchantType}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr 1.6fr auto auto",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                name="icon"
                placeholder="📚"
                maxLength={3}
                className="v2-input"
                style={{ width: 50, textAlign: "center", fontSize: 16, padding: "5px 8px" }}
              />
              <input
                name="label"
                placeholder="Libros"
                required
                className="v2-input"
                style={{ fontSize: 13, padding: "7px 10px" }}
              />
              <input
                name="description"
                placeholder="libros, revistas, e-books (opcional)"
                className="v2-input"
                style={{ fontSize: 12, padding: "7px 10px" }}
              />
              <select
                name="is_essential"
                defaultValue=""
                className="v2-select"
                style={{ fontSize: 12, padding: "7px 8px", width: "auto" }}
              >
                <option value="">— indef —</option>
                <option value="true">Esencial</option>
                <option value="false">Discrec.</option>
              </select>
              <input type="hidden" name="slug" value="" />
              <button
                type="submit"
                className="v2-btn sm primary"
                onClick={(e) => {
                  const form = e.currentTarget.closest("form")!;
                  const label = (form.elements.namedItem("label") as HTMLInputElement).value;
                  (form.elements.namedItem("slug") as HTMLInputElement).value = label;
                }}
              >
                <Icon.plus /> Agregar
              </button>
            </form>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>
              💡 Tip: el <strong>slug</strong> se genera automático desde el label
              (&ldquo;Mantenimiento Auto&rdquo; → <code>mantenimiento_auto</code>). La descripción le
              dice a Claude cuándo usar esta categoría.
            </div>
          </div>

          {/* Lista */}
          {customTypes.length === 0 ? (
            <div
              style={{
                padding: 30,
                textAlign: "center",
                color: "var(--text-3)",
                fontSize: 13,
              }}
            >
              No hay categorías custom todavía. Agregá la primera arriba ↑
            </div>
          ) : (
            <table className="v2-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Label</th>
                  <th>Slug</th>
                  <th>Descripción</th>
                  <th>Tipo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {customTypes.map((t) => (
                  <tr key={t.slug}>
                    <td style={{ fontSize: 18, textAlign: "center" }}>{t.icon ?? "·"}</td>
                    <td style={{ fontWeight: 500 }}>{t.label}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-3)" }}>
                      {t.slug}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-2)" }}>
                      {t.description ?? "—"}
                    </td>
                    <td>
                      {t.is_essential === true && (
                        <span className="v2-badge green">esencial</span>
                      )}
                      {t.is_essential === false && (
                        <span className="v2-badge amber">discrecional</span>
                      )}
                      {t.is_essential == null && (
                        <span style={{ fontSize: 11, color: "var(--text-3)" }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <form action={deleteCustomMerchantType}>
                        <input type="hidden" name="slug" value={t.slug} />
                        <button
                          type="submit"
                          className="v2-btn sm ghost"
                          style={{ color: "var(--red)" }}
                        >
                          <Icon.trash />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
