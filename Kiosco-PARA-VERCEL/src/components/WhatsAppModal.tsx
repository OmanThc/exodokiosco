import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Copy, Check, X, Phone, DollarSign, User } from 'lucide-react';
import { BuyerSummary } from '../types';
import { generateWhatsAppMessage } from '../utils/quincena';
import { formatMoney } from '../utils/format';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  buyer: BuyerSummary | null;
  periodLabel: string;
  currency: string;
  paymentInfo: string;
  businessName: string;
  onMarkAsPaid?: (buyerName: string) => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  buyer,
  periodLabel,
  currency,
  paymentInfo,
  businessName,
  onMarkAsPaid
}) => {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (buyer) {
      setPhone(buyer.telefono || '');
      const defaultText = generateWhatsAppMessage(buyer, periodLabel, currency, paymentInfo, businessName);
      setMessage(defaultText);
    }
  }, [buyer, periodLabel, currency, paymentInfo, businessName]);

  if (!isOpen || !buyer) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cleanPhoneForWhatsApp = (rawPhone: string) => {
    // Remove spaces, dashes, parentheses
    const digitsOnly = rawPhone.replace(/\D/g, '');
    return digitsOnly;
  };

  const handleSendWhatsApp = () => {
    const cleanPhone = cleanPhoneForWhatsApp(phone);
    const encoded = encodeURIComponent(message);
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-emerald-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Cobrar por WhatsApp</h3>
              <p className="text-xs text-emerald-100">Envío de resumen de cuenta quincenal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Buyer info pill */}
          <div className="flex items-center justify-between p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                {buyer.nombre.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{buyer.nombre}</p>
                <p className="text-xs text-gray-500">{buyer.totalProductos} productos consumidos</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-emerald-700 font-semibold uppercase tracking-wider block">Por cobrar</span>
              <span className="text-lg font-black text-emerald-700">
                {formatMoney(buyer.montoPendiente, currency)}
              </span>
            </div>
          </div>

          {/* Phone input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              Número de Teléfono (WhatsApp):
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej: +52 55 1234 5678 (incluye código de país si es posible)"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden transition-all"
            />
            <p className="text-[11px] text-gray-500">
              Si no incluyes el número, WhatsApp te dejará elegir el contacto directamente.
            </p>
          </div>

          {/* Message content */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600">
                Mensaje personalizado:
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado' : 'Copiar texto'}
              </button>
            </div>
            <textarea
              rows={7}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden resize-none"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={handleSendWhatsApp}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-[0.99]"
            >
              <Send className="w-4 h-4" />
              Abrir WhatsApp y Enviar
            </button>

            {onMarkAsPaid && buyer.montoPendiente > 0 && (
              <button
                onClick={() => {
                  onMarkAsPaid(buyer.nombre);
                  onClose();
                }}
                className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors border border-emerald-200"
              >
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Marcar como Pagado / Saldado
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
