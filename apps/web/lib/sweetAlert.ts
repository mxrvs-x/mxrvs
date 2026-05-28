import Swal from "sweetalert2";

type AlertType = "success" | "error" | "warning" | "info";

function isDarkTheme() {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "dark";
}

function sharedOptions() {
  return {
    background: isDarkTheme() ? "#111827" : "#ffffff",
    color: isDarkTheme() ? "#e5e7eb" : "#0f172a",
    confirmButtonColor: "#16a34a",
    cancelButtonColor: "#64748b",
    customClass: {
      popup: "mxrvs-alert",
      confirmButton: "mxrvs-alert-confirm",
      cancelButton: "mxrvs-alert-cancel",
    },
  };
}

export function appAlert(title: string, text: string, icon: AlertType = "info") {
  return Swal.fire({
    ...sharedOptions(),
    title,
    text,
    icon,
  });
}

export function appToast(title: string, icon: AlertType = "success") {
  return Swal.fire({
    ...sharedOptions(),
    title,
    icon,
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true,
  });
}

export async function appConfirm({
  title,
  text,
  confirmButtonText = "Confirm",
  icon = "warning",
}: {
  title: string;
  text: string;
  confirmButtonText?: string;
  icon?: AlertType;
}) {
  const result = await Swal.fire({
    ...sharedOptions(),
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText,
    reverseButtons: true,
  });

  return result.isConfirmed;
}
