import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useToast from '../../../../hooks/useToast';
import { getTimeRemaining } from '../../../../utils/timezoneHelper';
import PollPaymentInline from '../../../../components/PollPaymentInline';
import { submitPollResponse, updatePollResponse } from '../../../api';
import './ActivePollsCard.css';

const getEndTargetDate = (poll) => {
  if (!poll) return null;

  if (poll.end_date && poll.end_time) {
    const dateStr = new Date(poll.end_date).toISOString().split('T')[0];
    return `${dateStr}T${poll.end_time}`;
  }
  if (poll.event_date && poll.event_time) {
    const dateStr = new Date(poll.event_date).toISOString().split('T')[0];
    return `${dateStr}T${poll.event_time}`;
  }
  return poll.end_date || poll.event_date || null;
};

const getTimeLabel = (remaining) => {
  if (!remaining || remaining.expired) return 'Poll has ended';

  const parts = [];
  if (remaining.days > 0) parts.push(`${remaining.days}d`);
  if (remaining.hours > 0) parts.push(`${remaining.hours}h`);
  if (remaining.minutes > 0) parts.push(`${remaining.minutes}m`);
  if (parts.length === 0) parts.push(`${remaining.seconds}s`);
  return parts.join(' ');
};

const ActivePollsCard = ({ polls, onPollResponded }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const list = useMemo(() => (Array.isArray(polls) ? polls : []), [polls]);
  const userRole = localStorage.getItem('userRole');
  const canViewInactivePolls = userRole === 'admin' || userRole === 'moderator';
  const [index, setIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [comments, setComments] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [timer, setTimer] = useState(null);

  const [paymentVisible, setPaymentVisible] = useState(false);
  const [paymentPending, setPaymentPending] = useState(null);

  const handleOpenInactivePolls = () => {
    navigate('/announcement-management?tab=polls&status=closed');
  };

  const poll = list[index] || null;
  const pollCount = list.length;

  const endTarget = useMemo(
    () => getEndTargetDate(poll),
    [poll?._id, poll?.end_date, poll?.end_time, poll?.event_date, poll?.event_time]
  );

  useEffect(() => {
    if (!endTarget) {
      setTimer(null);
      return;
    }

    const tick = () => {
      setTimer(getTimeRemaining(endTarget));
    };

    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [endTarget]);

  useEffect(() => {
    if (!poll?._id) return;
    const existing = poll.user_response?.selected_options || [];

    setSelectedOptions((prev) => {
      const current = prev[poll._id] || [];
      const sameLength = current.length === existing.length;
      const sameValues = sameLength && current.every((v, i) => v === existing[i]);
      if (sameValues) return prev;
      return { ...prev, [poll._id]: existing };
    });
  }, [poll?._id, JSON.stringify(poll?.user_response?.selected_options || [])]);

  const canPrev = index > 0;
  const canNext = index < pollCount - 1;

  const handlePrev = () => {
    if (!canPrev) return;
    setIndex((v) => v - 1);
  };

  const handleNext = () => {
    if (!canNext) return;
    setIndex((v) => v + 1);
  };

  const handleSelect = (pollId, optionId) => {
    if (!poll) return;

    const pollType = poll.poll_type;

    if (pollType === 'multiple_choice') {
      setSelectedOptions((prev) => {
        const current = prev[pollId] || [];
        if (current.includes(optionId)) {
          return { ...prev, [pollId]: current.filter((id) => id !== optionId) };
        }
        return { ...prev, [pollId]: [...current, optionId] };
      });
      return;
    }

    setSelectedOptions((prev) => ({ ...prev, [pollId]: [optionId] }));

    const selected = poll.options?.find((o) => o.id === optionId);
    const optionText = selected?.text?.toLowerCase() || '';

    const alreadyPaid =
      poll?.payment_status === 'completed' ||
      poll?.user_response?.payment_status === 'completed';

    const eventFee = parseFloat(poll.virtual_meet_payment_amount ?? 5.0);

    if (
      poll?.event_type &&
      ['in-person', 'virtual', 'zoom-call', 'hybrid'].includes(poll.event_type) &&
      optionText.includes('yes') &&
      !alreadyPaid &&
      eventFee > 0
    ) {
      setPaymentPending({
        pollId,
        optionId,
        paymentAmount: eventFee,
        pollTitle: poll.title,
      });
      setPaymentVisible(true);
    } else {
      if (paymentPending?.pollId === pollId && !optionText.includes('yes')) {
        setPaymentPending(null);
        setPaymentVisible(false);
      }
    }
  };

  const handlePaymentCancel = () => {
    setPaymentVisible(false);
    setPaymentPending(null);
    if (paymentPending?.pollId) {
      setSelectedOptions((prev) => {
        const next = { ...prev };
        delete next[paymentPending.pollId];
        return next;
      });
    }
  };

  const handlePaymentComplete = async () => {
    toast.success('RSVP confirmed with payment!');
    setPaymentVisible(false);
    setPaymentPending(null);
    if (onPollResponded) onPollResponded();
  };

  const handleSubmit = async () => {
    if (!poll) return;
    const selected = selectedOptions[poll._id] || [];
    if (selected.length === 0 && poll.poll_type !== 'open_text') {
      toast.error('Please select an option');
      return;
    }

    const selectedOption = poll.options?.find((o) => o.id === selected[0]);
    const optionText = selectedOption?.text?.toLowerCase() || '';

    const alreadyPaidForYes = poll?.payment_status === 'completed';
    const eventFee = parseFloat(poll?.virtual_meet_payment_amount ?? 5.0);

    if (
      poll?.event_type &&
      ['in-person', 'virtual', 'zoom-call', 'hybrid'].includes(poll.event_type) &&
      optionText.includes('yes') &&
      !alreadyPaidForYes &&
      eventFee > 0
    ) {
      toast.warning('Payment required to confirm "Yes" response');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        poll_id: poll._id,
        selected_options: selected,
        comment: comments[poll._id] || null,
      };

      const isUpdate = !!poll.user_has_responded;

      if (isUpdate) {
        await updatePollResponse(poll._id, payload);
        toast.success('Response updated!');
      } else {
        await submitPollResponse(poll._id, payload);
        toast.success('Response submitted!');
      }

      if (onPollResponded) onPollResponded();

      const nextUnansweredIndex = list.findIndex((p, i) => i > index && !p.user_has_responded);
      if (nextUnansweredIndex !== -1) setIndex(nextUnansweredIndex);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  if (pollCount === 0) {
    return (
      <div className="dv2-rail-card">
        <div className="dv2-rail-title">
          <span className="dv2-rail-title-left">📣 Active polls</span>
          {canViewInactivePolls ? (
            <button className="dv2-poll-inactive-link" type="button" onClick={handleOpenInactivePolls}>
              Inactive polls
            </button>
          ) : null}
        </div>
        <div className="dv2-poll-empty">No active polls right now.</div>
      </div>
    );
  }

  const selected = selectedOptions[poll?._id] || [];

  return (
    <div className="dv2-rail-card">
      <div className="dv2-rail-title">
        <span className="dv2-rail-title-left">📣 Active polls</span>
        <div className="dv2-poll-title-actions">
          <span className="dv2-rail-pill">{pollCount}</span>
          {canViewInactivePolls ? (
            <button className="dv2-poll-inactive-link" type="button" onClick={handleOpenInactivePolls}>
              Inactive polls
            </button>
          ) : null}
        </div>
      </div>

      <div className="dv2-poll-question">{poll?.title}</div>

      {poll?.description ? (
        <div className="dv2-poll-desc" dangerouslySetInnerHTML={{ __html: poll.description }} />
      ) : null}

      {poll?.options?.length ? (
        <div className="dv2-poll-options">
          {poll.options
            .slice()
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((opt) => {
              const isSelected = selected.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  className={`dv2-poll-option ${isSelected ? 'dv2-poll-option-selected' : ''}`}
                  onClick={() => handleSelect(poll._id, opt.id)}
                  type="button"
                  disabled={submitting}
                >
                  <span className="dv2-poll-indicator">{isSelected ? '●' : '○'}</span>
                  <span className="dv2-poll-text">{opt.text}</span>
                </button>
              );
            })}
        </div>
      ) : null}

      {paymentPending?.pollId === poll?._id ? (
        <PollPaymentInline
          isVisible={paymentVisible}
          onCancel={handlePaymentCancel}
          onComplete={handlePaymentComplete}
          pollData={paymentPending}
        />
      ) : null}

      {poll?.allow_comments ? (
        <textarea
          className="dv2-poll-comment"
          placeholder="Add a comment (optional)…"
          value={comments[poll._id] || ''}
          onChange={(e) => setComments((prev) => ({ ...prev, [poll._id]: e.target.value }))}
          disabled={submitting}
          rows={2}
        />
      ) : null}

      {timer ? (
        <div className="dv2-poll-timer">⏱ Time remaining: <strong>{getTimeLabel(timer)}</strong></div>
      ) : null}

      <button className="dv2-poll-submit" type="button" onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Submitting…' : poll?.user_has_responded ? 'Update Response' : 'Submit Response'}
      </button>

      <div className="dv2-poll-nav">
        <button className="dv2-poll-nav-btn" type="button" onClick={handlePrev} disabled={!canPrev}>
          ◀
        </button>
        <span className="dv2-poll-nav-pos">Poll {index + 1} of {pollCount}</span>
        <button className="dv2-poll-nav-btn" type="button" onClick={handleNext} disabled={!canNext}>
          ▶
        </button>
      </div>
    </div>
  );
};

export default ActivePollsCard;
