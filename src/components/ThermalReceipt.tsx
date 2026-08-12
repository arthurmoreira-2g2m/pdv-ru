import React from 'react';
import { CouponData } from '../services/printerService';

interface ThermalReceiptProps {
  couponData: CouponData | null;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ couponData }) => {
  if (!couponData) return null;

  return (
    <div id="receipt-print-area" className="hidden print:block font-mono text-black">
      {/* CSS @media print styling is defined in index.css */}
      <div className="receipt-container w-[50mm] max-w-[50mm] mx-auto p-1 text-[10px] leading-tight text-center border-b border-black">
        {/* Header Logo Text */}
        <div className="font-black text-xs uppercase mb-1 border-b border-dashed border-black pb-1">
          *** 2G2M REFEITÓRIO ***
        </div>

        {/* Date & Time */}
        <div className="text-[9px] mb-1 font-semibold">
          Data: {couponData.dataHoraFormatada}
        </div>

        <div className="border-b border-dashed border-black my-1"></div>

        {/* Coupon Fields (Menores) */}
        <div className="text-left space-y-0.5 text-[8.5px] leading-tight">
          <div>
            <span className="font-bold">SERVIÇO:</span>{' '}
            <span className="font-extrabold uppercase text-[9.5px]">{couponData.servicoNome}</span>
          </div>
          <div>
            <span className="font-bold">ALUNO:</span>{' '}
            <span className="uppercase">{couponData.alunoNome}</span>
          </div>
          <div>
            <span className="font-bold">CURSO:</span>{' '}
            <span className="uppercase">{couponData.alunoCurso}</span>
          </div>
          <div>
            <span className="font-bold">MATRÍCULA:</span>{' '}
            <span className="font-bold">{couponData.alunoMatricula}</span>
          </div>
        </div>

        <div className="border-b border-dashed border-black my-1"></div>

        {/* Final Status Line - IMPRIME GRANDE */}
        <div className={`my-1 font-black uppercase text-center border-2 border-black ${
          couponData.isTotalGratis 
            ? 'text-base py-2.5 bg-black text-white tracking-widest' 
            : 'text-xs py-1.5 bg-white text-black font-extrabold'
        }`}>
          {couponData.statusLinha}
        </div>

        {/* Footer */}
        <div className="text-[8px] italic mt-1 pt-1 border-t border-dashed border-black">
          Obrigado! Bom apetite. 🍽️
        </div>
      </div>
    </div>
  );
};
