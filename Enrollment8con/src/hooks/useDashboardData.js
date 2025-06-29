import { useState, useEffect } from 'react';

const API_BASE_URL = "http://localhost:3000/api";

export const useDashboardData = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async (force = false) => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("token");
      const response = await fetch(API_BASE_URL + "/dashboard/kpi-data", {
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("HTTP " + response.status + ": " + response.statusText);
      }

      const data = await response.json();
      setDashboardData(data);
      return data;
    } catch (err) {
      console.error("Dashboard data fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    fetchDashboardData(true);
  };

  const clearCache = async () => {
    try {
      const token = localStorage.getItem("token");
      await fetch(API_BASE_URL + "/dashboard/clear-cache", {
        method: 'POST',
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json",
        },
      });
      await fetchDashboardData(true);
    } catch (err) {
      console.error("Failed to clear cache:", err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return {
    dashboardData,
    loading,
    error,
    refreshData,
    clearCache
  };
};