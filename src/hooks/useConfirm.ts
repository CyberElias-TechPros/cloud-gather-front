
import { useState, useCallback } from 'react';

interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

export const useConfirm = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: '',
    description: '',
  });
  const [resolveRef, setResolveRef] = useState<{
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions(opts);
      setIsOpen(true);
      setResolveRef({ resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (resolveRef) {
      resolveRef.resolve(true);
      setResolveRef(null);
    }
    setIsOpen(false);
  }, [resolveRef]);

  const handleCancel = useCallback(() => {
    if (resolveRef) {
      resolveRef.resolve(false);
      setResolveRef(null);
    }
    setIsOpen(false);
  }, [resolveRef]);

  return {
    confirm,
    isOpen,
    options,
    handleConfirm,
    handleCancel,
    setIsOpen,
  };
};
