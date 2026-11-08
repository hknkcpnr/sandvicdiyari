'use client';

import { useSelector, useDispatch } from 'react-redux';
import { closeMessageModal } from '@/store/slices/uiSlice';

export default function MessageModal() {
  const dispatch = useDispatch();
  const { isMessageModalOpen, messageModalData } = useSelector((state) => state.ui);

  if (!isMessageModalOpen) return null;

  const isSuccess = messageModalData.type === 'success';

  return (
    <div
      id="message-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm overflow-y-auto"
    >
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[92vh] overflow-y-auto">
        <div
          id="msg-icon"
          className={`w-12 h-12 rounded-full flex items-center justify-center text-xl mx-auto ${
            isSuccess ? 'bg-brand-100 text-brand-600' : 'bg-red-100 text-red-600'
          }`}
        >
          <i className={isSuccess ? 'fa-solid fa-check' : 'fa-solid fa-triangle-exclamation'}></i>
        </div>
        <h4 id="msg-title" className="font-bold text-lg text-stone-900">
          {messageModalData.title}
        </h4>
        <p id="msg-text" className="text-stone-500 text-sm">
          {messageModalData.text}
        </p>
        <button
          onClick={() => dispatch(closeMessageModal())}
          className="w-full bg-stone-900 hover:bg-stone-800 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
        >
          Tamam
        </button>
      </div>
    </div>
  );
}
