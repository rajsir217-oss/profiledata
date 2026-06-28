import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ContributionManagement from './ContributionManagement';
import UnifiedReports from './UnifiedReports';
import AdminUtilities from './AdminUtilities';
import MarketingPricing from './MarketingPricing';
import BlogManagement from './BlogManagement';
import TestSuite from './TestSuite';
import './AdminHub.css';

const SECTION_CONFIG = {
  contributions: {
    label: 'Contributions',
    subtitle: 'View and manage contributions',
    component: ContributionManagement,
  },
  reports: {
    label: 'Reports',
    subtitle: 'All reports and analytics',
    component: UnifiedReports,
  },
  utilities: {
    label: 'Utilities',
    subtitle: 'Admin tools and utilities',
    component: AdminUtilities,
  },
  marketing: {
    label: 'Marketing',
    subtitle: 'Promotions, pricing, and leads',
    component: MarketingPricing,
  },
  blog: {
    label: 'Blog',
    subtitle: 'Create and manage blog posts',
    component: BlogManagement,
  },
  'test-suite': {
    label: 'Test Suite',
    subtitle: 'Test dashboard and notification tools',
    component: TestSuite,
  },
};

const ADMIN_SECTIONS = ['contributions', 'reports', 'utilities', 'marketing', 'blog', 'test-suite'];

const AdminHub = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const sectionParam = params.get('section');
  const userRole = localStorage.getItem('userRole');
  const availableSections = useMemo(() => {
    if (userRole === 'admin') return ADMIN_SECTIONS;
    return [];
  }, [userRole]);
  const defaultSection = availableSections[0] || 'contributions';
  const section = availableSections.includes(sectionParam) ? sectionParam : defaultSection;

  React.useEffect(() => {
    if (userRole !== 'admin') {
      navigate('/dashboard');
      return;
    }

    if (!availableSections.includes(sectionParam || '')) {
      navigate(`/admin-hub?section=${defaultSection}`, { replace: true });
    }
  }, [navigate, userRole, availableSections, sectionParam, defaultSection]);

  const handleSectionChange = (event) => {
    const nextSection = event.target.value;
    navigate(`/admin-hub?section=${nextSection}`);
  };

  const ActiveComponent = SECTION_CONFIG[section].component;

  return (
    <div className="admin-hub">
      <div className="admin-hub-controls">
        <div className="admin-hub-controls-row">
          <div className="admin-hub-controls-left">
            <label htmlFor="admin-hub-section" className="admin-hub-label">Workspace</label>
            <p className="admin-hub-subtitle">{SECTION_CONFIG[section].subtitle}</p>
          </div>

          <div className="admin-hub-controls-right">
            <select
              id="admin-hub-section"
              className="admin-hub-select"
              value={section}
              onChange={handleSectionChange}
            >
              {availableSections.map((sectionId) => (
                <option key={sectionId} value={sectionId}>{SECTION_CONFIG[sectionId].label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="admin-hub-content">
        {section === 'reports' ? (
          <ActiveComponent routeBase="/admin-hub" baseParams={{ section: 'reports' }} />
        ) : section === 'utilities' ? (
          <ActiveComponent routeBase="/admin-hub" baseParams={{ section: 'utilities' }} />
        ) : section === 'marketing' ? (
          <ActiveComponent routeBase="/admin-hub" baseParams={{ section: 'marketing' }} />
        ) : section === 'test-suite' ? (
          <ActiveComponent routeBase="/admin-hub" baseParams={{ section: 'test-suite' }} />
        ) : (
          <ActiveComponent />
        )}
      </div>
    </div>
  );
};

export default AdminHub;
