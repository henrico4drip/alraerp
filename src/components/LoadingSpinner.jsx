import React from 'react';

export default function LoadingSpinner() {
    return (
        <div className="flex justify-center items-center py-20">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
    );
}
