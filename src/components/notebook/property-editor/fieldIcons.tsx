import { Calendar, Hash, Tag, Link2, Type, ToggleLeft, ToggleRight } from 'lucide-react';
import type { PropertyType } from '../../../types/notebook';

export function getFieldIcon(type: PropertyType, value?: unknown) {
  switch (type) {
    case 'text':
      return <Type size={14} className="text-gray-500" />;
    case 'number':
      return <Hash size={14} className="text-blue-500" />;
    case 'boolean':
      return value ? <ToggleRight size={14} className="text-green-500" /> : <ToggleLeft size={14} className="text-gray-400" />;
    case 'date':
      return <Calendar size={14} className="text-purple-500" />;
    case 'tag':
      return <Tag size={14} className="text-orange-500" />;
    case 'reference':
      return <Link2 size={14} className="text-indigo-500" />;
    case 'select':
      return <Type size={14} className="text-green-500" />;
    default:
      return null;
  }
}