import { X } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import {
  Dialog,
  Form,
  Heading,
  Modal,
  ModalOverlay,
  Text,
} from "react-aria-components";
import { Button } from "./Button";
import { modalFormStyles } from "./modal-form.styles";

export function ModalForm({
  isOpen,
  isSubmitting,
  title,
  description,
  closeLabel,
  cancelLabel,
  submitLabel,
  submittingLabel,
  message,
  onOpenChange,
  onSubmit,
  children,
}: {
  isOpen: boolean;
  isSubmitting: boolean;
  title: string;
  description: string;
  closeLabel: string;
  cancelLabel: string;
  submitLabel: string;
  submittingLabel: string;
  message: string;
  onOpenChange: (isOpen: boolean, reason?: "dismiss" | "saved") => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  const styles = modalFormStyles();
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(nextOpen) =>
        onOpenChange(nextOpen, nextOpen ? undefined : "dismiss")
      }
      isDismissable
      isKeyboardDismissDisabled={false}
      className={styles.overlay()}
    >
      <Modal className={styles.modal()}>
        <Dialog className={styles.dialog()}>
          <header className={styles.header()}>
            <div className={styles.headerContent()}>
              <Heading slot="title" className={styles.title()}>
                {title}
              </Heading>
              <Text slot="description" className={styles.description()}>
                {description}
              </Text>
            </div>
            <Button
              appearance="quietNeutral"
              aria-label={closeLabel}
              slot="close"
            >
              <X aria-hidden="true" size={18} />
            </Button>
          </header>
          <Form className={styles.form()} onSubmit={onSubmit}>
            <div data-profile-dialog className={styles.content()}>
              {children}
            </div>
            <footer className={styles.footer()}>
              {message && (
                <p className={styles.message()} role="alert">
                  {message}
                </p>
              )}
              <div className={styles.actions()}>
                <Button
                  appearance="secondary"
                  type="button"
                  slot="close"
                  isDisabled={isSubmitting}
                >
                  {cancelLabel}
                </Button>
                <Button
                  appearance="primary"
                  type="submit"
                  isDisabled={isSubmitting}
                >
                  {isSubmitting ? submittingLabel : submitLabel}
                </Button>
              </div>
            </footer>
          </Form>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
