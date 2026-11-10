export const getStudyPlanProgress = (activities = []) => {
  const items = Array.isArray(activities) ? activities : [];
  const total = items.length;
  const completed = items.filter((activity) => activity?.completed === true).length;
  const allCompleted = total > 0 && completed === total;
  const percentage = total === 0 ? 0 : allCompleted ? 100 : Math.min(99, Math.round((completed / total) * 100));

  return { total, completed, percentage, allCompleted };
};
