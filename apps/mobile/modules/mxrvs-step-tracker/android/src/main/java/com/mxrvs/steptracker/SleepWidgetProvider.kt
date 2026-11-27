package com.mxrvs.steptracker

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews

class SleepWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    val views = createViews(context)
    ids.forEach { manager.updateAppWidget(it, views) }
  }

  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action
    if (action != null && action.startsWith(ACTION_PREFIX)) {
      SleepWidgetStore.record(context, action.removePrefix(ACTION_PREFIX))
      updateAll(context)
    } else {
      super.onReceive(context, intent)
    }
  }

  companion object {
    private const val ACTION_PREFIX = "com.mxrvs.steptracker.SLEEP_WIDGET."
    private val FLAGS = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

    internal fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val provider = ComponentName(context, SleepWidgetProvider::class.java)
      if (manager.getAppWidgetIds(provider).isNotEmpty()) {
        manager.updateAppWidget(provider, createViews(context))
      }
    }

    private fun createViews(context: Context): RemoteViews {
      val (configured, recording) = SleepWidgetStore.widgetState(context)
      val finished = recording != null && !recording.isNull("finishedAt")
      val awake = recording != null && !recording.isNull("awakeSince")
      val active = recording != null && !finished
      val activity = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
        action = Intent.ACTION_VIEW
        data = Uri.parse("mxrvs:///?sleepWidget=1")
      }
      val openApp = activity?.let { PendingIntent.getActivity(context, 20, it, FLAGS) }
      val action = when {
        !configured || finished -> openApp
        recording == null -> tap(context, "start")
        awake -> tap(context, "resume")
        else -> tap(context, "wake")
      }

      return RemoteViews(context.packageName, R.layout.mxrvs_sleep_widget).apply {
        setTextViewText(R.id.sleep_widget_status, context.getText(when {
          !configured -> R.string.sleep_widget_sign_in
          finished -> R.string.sleep_widget_ready
          awake -> R.string.sleep_widget_awake
          active -> R.string.sleep_widget_recording
          else -> R.string.sleep_widget_idle
        }))
        setTextViewText(R.id.sleep_widget_action, context.getText(when {
          !configured -> R.string.sleep_widget_open
          finished -> R.string.sleep_widget_review
          awake -> R.string.sleep_widget_resume
          active -> R.string.sleep_widget_wake
          else -> R.string.sleep_widget_start
        }))
        setOnClickPendingIntent(R.id.sleep_widget_action, action)
        setViewVisibility(R.id.sleep_widget_finish, if (active) View.VISIBLE else View.GONE)
        setOnClickPendingIntent(R.id.sleep_widget_finish, tap(context, "finish"))
      }
    }

    private fun tap(context: Context, action: String): PendingIntent {
      val intent = Intent(context, SleepWidgetProvider::class.java).setAction(ACTION_PREFIX + action)
      return PendingIntent.getBroadcast(context, 0, intent, FLAGS)
    }
  }
}
