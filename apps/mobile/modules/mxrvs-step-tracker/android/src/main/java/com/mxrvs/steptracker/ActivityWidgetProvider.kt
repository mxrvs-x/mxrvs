package com.mxrvs.steptracker

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews
import kotlin.math.roundToInt

class ActivityWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    appWidgetIds.forEach { widgetId ->
      appWidgetManager.updateAppWidget(widgetId, createViews(context))
    }
  }

  override fun onEnabled(context: Context) {
    super.onEnabled(context)
    StepCounterService.startIfPermitted(context)
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val component = ComponentName(context, ActivityWidgetProvider::class.java)
      val ids = manager.getAppWidgetIds(component)
      if (ids.isEmpty()) return

      val views = createViews(context)
      ids.forEach { manager.updateAppWidget(it, views) }
      StepTrackerStore.markWidgetRefreshed(
        context,
        StepTrackerStore.getSteps(context),
        System.currentTimeMillis()
      )
    }

    private fun createViews(context: Context): RemoteViews {
      val activity = StepTrackerStore.snapshot(context)
      val steps = activity["steps"] as Int
      val movingSeconds = activity["movingSeconds"] as Int
      val calories = activity["caloriesBurned"] as Int
      val minutes = (movingSeconds / 60.0).roundToInt()
      val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      val pendingIntent =
        launchIntent?.let {
          PendingIntent.getActivity(
            context,
            0,
            it,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
          )
        }

      return RemoteViews(context.packageName, R.layout.mxrvs_activity_widget).apply {
        setTextViewText(R.id.widget_steps, "%,d".format(steps))
        setTextViewText(R.id.widget_moving, "$minutes min")
        setTextViewText(
          R.id.widget_calories,
          if (activity["weightKg"] != null) "$calories kcal" else "Log weight"
        )
        if (pendingIntent != null) {
          setOnClickPendingIntent(R.id.widget_root, pendingIntent)
        }
      }
    }
  }
}
