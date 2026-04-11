import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dialog } from "@/components/ui/dialog";
import {
  AdminConfirmDialog,
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableCell,
  AdminDataTableHead,
  AdminDataTableHeader,
  AdminDataTableRow,
  AdminModal,
  AdminModalBody,
  AdminModalDescription,
  AdminModalFooter,
  AdminModalHeader,
  AdminModalTitle,
  AdminTableShell,
} from "@/components/admin/ui";

describe("admin ui primitives", () => {
  it("renders modal size and sticky footer styles", () => {
    render(
      <Dialog open>
        <AdminModal size="xl" stickyFooter>
          <AdminModalHeader>
            <AdminModalTitle>Example</AdminModalTitle>
            <AdminModalDescription>Example modal</AdminModalDescription>
          </AdminModalHeader>
          <AdminModalBody>Body</AdminModalBody>
          <AdminModalFooter>Footer</AdminModalFooter>
        </AdminModal>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-size", "xl");
    expect(dialog.className).toContain("admin-modal-shell");
    expect(screen.getByText("Footer").className).toContain("sticky");
  });

  it("renders confirm dialog intent styles and custom content", () => {
    render(
      <AdminConfirmDialog
        open
        onOpenChange={() => {}}
        title="Delete item?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {}}
      >
        <div>Extra warning</div>
      </AdminConfirmDialog>,
    );

    expect(screen.getByText("Delete item?")).toBeInTheDocument();
    expect(screen.getByText("Extra warning")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" }).className).toContain("bg-red-600");
  });

  it("renders table shell toolbar/footer and compact sticky table cells", () => {
    const { container } = render(
      <AdminTableShell toolbar={<div>Toolbar</div>} footer={<div>Footer</div>}>
        <AdminDataTable stickyHeader compact>
          <AdminDataTableHeader>
            <AdminDataTableRow>
              <AdminDataTableHead>Column</AdminDataTableHead>
              <AdminDataTableHead align="right">Actions</AdminDataTableHead>
            </AdminDataTableRow>
          </AdminDataTableHeader>
          <AdminDataTableBody>
            <AdminDataTableRow>
              <AdminDataTableCell>Value</AdminDataTableCell>
              <AdminDataTableCell align="right">Edit</AdminDataTableCell>
            </AdminDataTableRow>
          </AdminDataTableBody>
        </AdminDataTable>
      </AdminTableShell>,
    );

    expect(screen.getByText("Toolbar")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
    const header = container.querySelector("thead");
    const headerCell = container.querySelector("th");
    expect(headerCell?.className).toContain("text-[10px]");
    expect(header?.className).toContain("sticky");
  });
});
