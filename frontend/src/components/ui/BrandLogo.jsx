import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import logo from '@/assets/logo.png';

/**
 * BrandLogo - Unified branding component for Cognify
 * @param {boolean} isCollapsed - Whether showing iconic only (sidebar collapse)
 * @param {boolean} isAdmin - Whether to show Admin designation
 * @param {string} className - Additional classes
 * @param {string} to - Link destination (default: /)
 */
const BrandLogo = ({ isCollapsed = false, isAdmin = false, className = '', to = '/' }) => {
    return (
        <Link 
            to={to} 
            className={`flex items-center gap-3 group/logo ${className}`}
        >
            <motion.div 
                className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                whileHover={{ scale: 1.05, rotate: [0, -5, 5, 0] }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
                <img src={logo} alt="Cognify" className="w-full h-full object-contain" />
            </motion.div>

            {!isCollapsed && (
                <div className="flex flex-col">
                    <span className="text-xl font-black tracking-tight text-[#2d3a74] leading-none">
                        Cogni<span className="text-[#8ce0c9]">fy</span>
                        {isAdmin && (
                            <span className="ml-1.5 text-[#8ce0c9] opacity-80 font-black">Admin</span>
                        )}
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400 mt-1">
                        {isAdmin ? 'Operation Center' : 'Growth Engine'}
                    </span>
                </div>
            )}
        </Link>
    );
};

export default BrandLogo;
