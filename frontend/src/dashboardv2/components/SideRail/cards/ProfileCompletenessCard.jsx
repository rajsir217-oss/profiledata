import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProfileCompletenessCard.css';

const compute = (profile) => {
  if (!profile) return { score: 0, missing: [] };

  const checks = [
    { key: 'firstName', label: 'First name', ok: !!profile.firstName },
    { key: 'lastName', label: 'Last name', ok: !!profile.lastName },
    { key: 'location', label: 'Location', ok: !!profile.location },
    { key: 'aboutYou', label: 'Bio', ok: !!profile.aboutYou },
    {
      key: 'photos',
      label: 'Photos',
      ok:
        (Array.isArray(profile.images) && profile.images.length > 0) ||
        (Array.isArray(profile.publicImages) && profile.publicImages.length > 0) ||
        !!profile.profileImage,
    },
    {
      key: 'occupation',
      label: 'Occupation',
      ok: !!profile.occupation || !!profile.workExperience,
    },
    { key: 'education', label: 'Education', ok: !!profile.education },
  ];

  const okCount = checks.filter((c) => c.ok).length;
  const score = Math.round((okCount / checks.length) * 100);
  const missing = checks.filter((c) => !c.ok).map((c) => c.label);
  return { score, missing };
};

const ProfileCompletenessCard = ({ userProfile }) => {
  const navigate = useNavigate();

  const data = useMemo(() => {
    const fromMeta = userProfile?.metaFields?.profileCompleteness;
    if (typeof fromMeta === 'number' && fromMeta >= 0 && fromMeta <= 100) {
      return { score: Math.round(fromMeta), missing: [] };
    }
    return compute(userProfile);
  }, [userProfile]);

  return (
    <div className="dv2-rail-card">
      <div className="dv2-rail-title">
        <span className="dv2-rail-title-left">✨ Profile strength</span>
        <span className="dv2-rail-pill">{data.score}%</span>
      </div>
      <progress className="dv2-pc-progress" value={data.score} max={100} />
      {data.missing.length > 0 ? (
        <div className="dv2-pc-missing">
          Missing: <strong>{data.missing.slice(0, 3).join(', ')}</strong>
        </div>
      ) : (
        <div className="dv2-pc-missing">Looking good — keep it up.</div>
      )}
      <button className="dv2-pc-cta" type="button" onClick={() => navigate('/edit-profile')}>
        Improve profile
      </button>
    </div>
  );
};

export default ProfileCompletenessCard;
