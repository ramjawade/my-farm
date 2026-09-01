import { Injectable } from '@angular/core';
import { Activity, ActivityExpense } from '../../features/activity/activity.models';
import { WeatherData } from '../weather/weather.models';
import { IStorageService } from './storage.interface';

@Injectable({ providedIn: 'root' })
export class LocalStorageService extends IStorageService {
  private getActivitiesKey(userId: string): string {
    return `my_farm_${userId}_activities`;
  }

  private getExpensesKey(userId: string): string {
    return `my_farm_${userId}_activity_expenses`;
  }

  async getActivities(userId: string): Promise<Activity[]> {
    const key = this.getActivitiesKey(userId);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  async getExpenses(userId: string): Promise<ActivityExpense[]> {
    const key = this.getExpensesKey(userId);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  async saveActivity(userId: string, activity: Activity): Promise<Activity> {
    const key = this.getActivitiesKey(userId);
    const activities = await this.getActivities(userId);
    activities.push(activity);
    localStorage.setItem(key, JSON.stringify(activities));
    return activity;
  }

  async saveExpense(userId: string, expense: ActivityExpense): Promise<ActivityExpense> {
    const key = this.getExpensesKey(userId);
    const expenses = await this.getExpenses(userId);
    expenses.push(expense);
    localStorage.setItem(key, JSON.stringify(expenses));
    return expense;
  }

  async updateActivity(userId: string, id: string, updates: Partial<Activity>): Promise<void> {
    const key = this.getActivitiesKey(userId);
    const activities = await this.getActivities(userId);
    const index = activities.findIndex((a) => a.id === id);
    if (index !== -1) {
      activities[index] = { ...activities[index], ...updates };
      localStorage.setItem(key, JSON.stringify(activities));
    }
  }

  async updateExpense(
    userId: string,
    id: string,
    updates: Partial<ActivityExpense>,
  ): Promise<void> {
    const key = this.getExpensesKey(userId);
    const expenses = await this.getExpenses(userId);
    const index = expenses.findIndex((e) => e.id === id);
    if (index !== -1) {
      expenses[index] = { ...expenses[index], ...updates };
      localStorage.setItem(key, JSON.stringify(expenses));
    }
  }

  async deleteActivity(userId: string, id: string): Promise<void> {
    const key = this.getActivitiesKey(userId);
    const activities = await this.getActivities(userId);
    const filtered = activities.filter((a) => a.id !== id);
    localStorage.setItem(key, JSON.stringify(filtered));
  }

  async deleteExpense(userId: string, id: string): Promise<void> {
    const key = this.getExpensesKey(userId);
    const expenses = await this.getExpenses(userId);
    const filtered = expenses.filter((e) => e.id !== id);
    localStorage.setItem(key, JSON.stringify(filtered));
  }

  async syncActivitiesForField(userId: string, fieldId: string): Promise<Activity[]> {
    const activities = await this.getActivities(userId);
    return activities.filter((a) => a.fieldId === fieldId);
  }

  async syncExpensesForActivity(userId: string, activityId: string): Promise<ActivityExpense[]> {
    const expenses = await this.getExpenses(userId);
    return expenses.filter((e) => e.activityId === activityId);
  }

  private getWeatherHistoryKey(userId: string): string {
    return `my_farm_${userId}_weather_history`;
  }

  async getWeatherHistory(userId: string): Promise<WeatherData[]> {
    const key = this.getWeatherHistoryKey(userId);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  async saveWeatherHistory(userId: string, history: WeatherData[]): Promise<void> {
    const key = this.getWeatherHistoryKey(userId);
    localStorage.setItem(key, JSON.stringify(history));
  }
}
